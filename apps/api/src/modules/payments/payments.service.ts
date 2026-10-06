import type Stripe from 'stripe';
import { cancelOrder, markPaid } from '../orders/order.service';
import { OrderModel } from '../orders/order.model';
import { refundPayment, retrieveCheckoutSession, STRIPE_CURRENCY, stripeEnabled, toMinorUnits } from './stripe';

/**
 * Reacts to Stripe events. Every handler is idempotent: Stripe retries
 * webhooks and the sweeper may process the same session again.
 */

const paymentIntentIdOf = (s: Stripe.Checkout.Session) =>
  typeof s.payment_intent === 'string' ? s.payment_intent : (s.payment_intent?.id ?? null);

const orderIdOf = (s: Stripe.Checkout.Session) => s.metadata?.orderId ?? s.client_reference_id ?? null;

/** Payment succeeded: verify it matches the order, then send the order to the kitchen. */
export async function confirmCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = orderIdOf(session);
  if (!orderId) return console.warn(`[payments] session ${session.id} has no order id`);
  const order = await OrderModel.findById(orderId);
  if (!order) return console.warn(`[payments] session ${session.id} refers to unknown order ${orderId}`);
  if (order.paymentStatus === 'Paid' || order.paymentStatus === 'Refunded') return; // already handled

  const paymentIntentId = paymentIntentIdOf(session);
  const expected = toMinorUnits(order.totalAmount);
  if (session.amount_total !== expected || session.currency !== STRIPE_CURRENCY) {
    // Should be impossible (the session is built from the order), but never accept a mismatch silently.
    console.error(
      `[payments] amount mismatch for order ${orderId}: paid ${session.amount_total} ${session.currency}, expected ${expected} ${STRIPE_CURRENCY}`,
    );
    return;
  }

  if (order.status === 'Awaiting Payment') {
    await markPaid(orderId, paymentIntentId, session.amount_total);
    console.log(`[payments] order ${orderId} paid`);
    return;
  }

  // Paid after we had already cancelled it (e.g. checkout expired at the same moment): give the money back.
  if (order.status === 'Cancelled' && paymentIntentId) {
    const refund = await refundPayment(paymentIntentId, orderId);
    await OrderModel.updateOne(
      { _id: orderId },
      { paymentStatus: 'Refunded', 'payment.paymentIntentId': paymentIntentId, 'payment.refundId': refund.id },
    );
    console.warn(`[payments] order ${orderId} was paid after cancellation — refunded ${refund.id}`);
  }
}

/** Checkout expired or an async payment failed: release the stock. */
export async function failCheckout(session: Stripe.Checkout.Session, reason: string): Promise<void> {
  const orderId = orderIdOf(session);
  if (!orderId) return;
  const order = await OrderModel.findById(orderId);
  if (order?.status !== 'Awaiting Payment') return;
  await cancelOrder(orderId, null, reason, { system: true });
  console.log(`[payments] order ${orderId} cancelled: ${reason}`);
}

export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      // Cards are paid immediately; delayed methods report via async_payment_* events.
      if (event.data.object.payment_status === 'paid') await confirmCheckout(event.data.object);
      break;
    case 'checkout.session.async_payment_succeeded':
      await confirmCheckout(event.data.object);
      break;
    case 'checkout.session.async_payment_failed':
      await failCheckout(event.data.object, 'Payment failed');
      break;
    case 'checkout.session.expired':
      await failCheckout(event.data.object, 'Payment not completed in time');
      break;
    case 'charge.refunded': {
      // Also covers refunds issued from the Stripe Dashboard.
      const pi = event.data.object.payment_intent;
      const id = typeof pi === 'string' ? pi : pi?.id;
      if (id && event.data.object.refunded) {
        await OrderModel.updateOne({ 'payment.paymentIntentId': id }, { paymentStatus: 'Refunded' });
      }
      break;
    }
    default:
      break; // other events are acknowledged and ignored
  }
}

/**
 * Safety net for missed webhooks: settles unpaid orders whose checkout
 * window has passed, asking Stripe for the truth.
 */
export async function sweepUnpaidOrders(): Promise<void> {
  if (!stripeEnabled()) return;
  const now = Date.now();
  const stale = await OrderModel.find({
    status: 'Awaiting Payment',
    $or: [
      { 'payment.checkoutExpiresAt': { $lt: new Date(now - 60_000) } },
      // Session creation never completed.
      { 'payment.checkoutSessionId': { $exists: false }, createdAt: { $lt: new Date(now - 10 * 60_000) } },
    ],
  }).limit(50);

  for (const order of stale) {
    try {
      const sessionId = order.payment?.checkoutSessionId;
      if (!sessionId) {
        await cancelOrder(order.id, null, 'Payment could not be started', { system: true });
        continue;
      }
      const session = await retrieveCheckoutSession(sessionId);
      if (session.payment_status === 'paid') await confirmCheckout(session);
      else await failCheckout(session, 'Payment not completed in time');
    } catch (err) {
      console.error(`[payments] sweep failed for order ${order.id}`, err);
    }
  }
}

let timer: NodeJS.Timeout | null = null;
export function startPaymentSweeper(intervalMs = 5 * 60_000): void {
  if (timer) return;
  timer = setInterval(() => void sweepUnpaidOrders(), intervalMs);
  timer.unref();
}
export function stopPaymentSweeper(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
