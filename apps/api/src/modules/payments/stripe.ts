import Stripe from 'stripe';
import { CURRENCY } from '@store/shared';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { resolveImage } from '../media/media.service';
import type { OrderDocument } from '../orders/order.model';

/**
 * Thin wrapper around the Stripe SDK. Holds no order logic, so the order
 * service can call it without circular imports.
 */

const CHECKOUT_TTL_MS = 31 * 60 * 1000; // Stripe's minimum is 30 minutes
export const STRIPE_CURRENCY = CURRENCY.toLowerCase();

let client: Stripe | null = null;

export function stripeEnabled(): boolean {
  return !!env.STRIPE_SECRET_KEY;
}

export function stripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) throw new AppError(503, 'Online payments are not set up yet');
  if (!client) {
    const base = env.STRIPE_API_BASE ? new URL(env.STRIPE_API_BASE) : null;
    client = new Stripe(env.STRIPE_SECRET_KEY, {
      maxNetworkRetries: 2,
      timeout: 15_000,
      appInfo: { name: 'store-app' },
      ...(base && {
        host: base.hostname,
        port: Number(base.port) || (base.protocol === 'https:' ? 443 : 80),
        protocol: base.protocol.replace(':', '') as 'http' | 'https',
      }),
    });
  }
  return client;
}

export const toMinorUnits = (amount: number) => Math.round(amount * 100);

/** Where Stripe sends the customer afterwards. The app flow lands on a page that needs no login. */
function returnUrls(orderId: string, returnTo: 'web' | 'app') {
  if (returnTo === 'app') {
    const done = `${env.WEB_URL}/checkout/complete?order=${orderId}`;
    return { success_url: `${done}&status=paid&app=1`, cancel_url: `${done}&status=cancelled&app=1` };
  }
  return {
    success_url: `${env.WEB_URL}/orders/${orderId}?paid=1`,
    cancel_url: `${env.WEB_URL}/checkout?cancelled=${orderId}`,
  };
}

export async function createCheckoutSession(
  order: OrderDocument,
  customerEmail: string | undefined,
  returnTo: 'web' | 'app',
): Promise<Stripe.Checkout.Session> {
  const orderId = order.id as string;
  const expiresAt = Math.floor((Date.now() + CHECKOUT_TTL_MS) / 1000);

  return stripe().checkout.sessions.create(
    {
      mode: 'payment',
      line_items: order.items.map((item) => {
        // Stripe can only show images it can fetch over HTTPS.
        const image = resolveImage(item.image) ?? '';
        return {
          quantity: item.quantity,
          price_data: {
            currency: STRIPE_CURRENCY,
            unit_amount: toMinorUnits(item.price),
            product_data: { name: item.title, ...(image.startsWith('https://') && { images: [image] }) },
          },
        };
      }),
      customer_email: customerEmail,
      client_reference_id: orderId,
      metadata: { orderId },
      payment_intent_data: {
        metadata: { orderId },
        description: `Order #${orderId.slice(-6).toUpperCase()}`,
      },
      expires_at: expiresAt,
      ...returnUrls(orderId, returnTo),
    },
    { idempotencyKey: `checkout-${orderId}` },
  );
}

/** Full refund. Idempotent per order, so retries can't refund twice. */
export async function refundPayment(paymentIntentId: string, orderId: string): Promise<Stripe.Refund> {
  return stripe().refunds.create(
    { payment_intent: paymentIntentId, metadata: { orderId } },
    { idempotencyKey: `refund-${orderId}` },
  );
}

/** Closes an open Checkout page so it can no longer be paid. Already-closed sessions are fine. */
export async function expireCheckoutSession(sessionId: string): Promise<void> {
  try {
    await stripe().checkout.sessions.expire(sessionId);
  } catch (err) {
    if (!(err instanceof Stripe.errors.StripeInvalidRequestError)) throw err;
  }
}

export function retrieveCheckoutSession(sessionId: string) {
  return stripe().checkout.sessions.retrieve(sessionId);
}

/** Verifies a webhook's signature and parses it. Throws if it wasn't sent by Stripe. */
export function constructWebhookEvent(rawBody: Buffer, signature: string | undefined): Stripe.Event {
  if (!env.STRIPE_WEBHOOK_SECRET) throw new AppError(503, 'Stripe webhook secret is not configured');
  if (!signature) throw AppError.badRequest('Missing Stripe-Signature header');
  try {
    // constructEvent only needs the secret; reuse the client when available.
    const s = client ?? new Stripe(env.STRIPE_SECRET_KEY ?? 'sk_unused');
    return s.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    throw AppError.badRequest('Invalid Stripe signature');
  }
}
