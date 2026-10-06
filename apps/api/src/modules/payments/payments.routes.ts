import type { Request, Response } from 'express';
import { handleStripeEvent } from './payments.service';
import { constructWebhookEvent } from './stripe';

/**
 * POST /api/v1/payments/webhook — mounted in app.ts with express.raw(),
 * because Stripe's signature is computed over the exact request bytes.
 */
export async function stripeWebhook(req: Request, res: Response) {
  const event = constructWebhookEvent(req.body as Buffer, req.header('stripe-signature'));
  try {
    await handleStripeEvent(event);
  } catch (err) {
    // A 5xx makes Stripe retry later (with backoff for up to 3 days).
    console.error(`[payments] failed to handle ${event.type} ${event.id}`, err);
    res.status(500).json({ error: { message: 'Webhook handler failed' } });
    return;
  }
  res.json({ received: true });
}
