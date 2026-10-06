import mongoose, { type ClientSession, type FilterQuery } from 'mongoose';
import {
  canTransition,
  type CheckoutResponse,
  type OrderDTO,
  type OrderStatus,
  type Paginated,
  type PaymentStatus,
  type Role,
} from '@store/shared';
import { AppError } from '../../utils/AppError';
import { createCheckoutSession, expireCheckoutSession, refundPayment, stripeEnabled } from '../payments/stripe';
import { ProductModel } from '../products/product.model';
import { broadcastOrderCreated, broadcastOrderUpdated, broadcastStockChanged } from './order.events';
import { OrderModel, orderCustomerId, toOrderDTO, type Order, type OrderDocument } from './order.model';
import type { CreateOrderInput, ListOrdersInput, UpdateStatusInput } from './order.schemas';

const CUSTOMER_FIELDS = 'name email';
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Places an order and starts payment:
 *  1. In a transaction: atomically reserve stock for each line (fails if
 *     insufficient), snapshot title/price/image from the DB — client prices
 *     are never trusted — and persist the order as "Awaiting Payment".
 *  2. Create a Stripe Checkout session for exactly those snapshot prices.
 * The kitchen only sees the order once Stripe confirms payment (webhook).
 * If the customer never pays, the session expires and the stock is released.
 */
export async function createOrder(customerId: string, input: CreateOrderInput): Promise<CheckoutResponse> {
  if (!stripeEnabled()) throw new AppError(503, 'Online payments are not set up yet. Please try again later.');

  // Merge duplicate lines for the same product.
  const qtyByProduct = new Map<string, number>();
  for (const { productId, quantity } of input.items) {
    qtyByProduct.set(productId, (qtyByProduct.get(productId) ?? 0) + quantity);
  }

  let order!: OrderDocument;
  const stockChanges: { id: string; stockQuantity: number }[] = [];

  await mongoose.connection.transaction(async (session) => {
    stockChanges.length = 0; // transaction callbacks may be retried
    const items = [];

    for (const [productId, quantity] of qtyByProduct) {
      const product = await ProductModel.findOneAndUpdate(
        { _id: productId, isActive: true, stockQuantity: { $gte: quantity } },
        { $inc: { stockQuantity: -quantity, soldCount: quantity } },
        { new: true, session },
      );
      if (!product) {
        const p = await ProductModel.findById(productId).session(session).lean();
        throw !p || !p.isActive
          ? AppError.badRequest(`Product ${productId} is unavailable`)
          : AppError.conflict(`Only ${p.stockQuantity} of "${p.title}" left in stock`, {
              productId,
              available: p.stockQuantity,
            });
      }
      stockChanges.push({ id: product.id, stockQuantity: product.stockQuantity });
      items.push({
        product: product._id,
        title: product.title,
        image: product.images[0],
        price: product.price,
        quantity,
      });
    }

    const totalAmount = round2(items.reduce((sum, i) => sum + i.price * i.quantity, 0));

    [order] = await OrderModel.create(
      [
        {
          customer: customerId,
          items,
          totalAmount,
          shippingAddress: input.shippingAddress,
          status: 'Awaiting Payment',
          statusHistory: [{ status: 'Awaiting Payment', by: customerId }],
          paymentStatus: 'Pending',
        },
      ],
      { session },
    );
  });
  for (const s of stockChanges) broadcastStockChanged(s.id, s.stockQuantity);

  await order.populate('customer', CUSTOMER_FIELDS);
  const email = (order.customer as unknown as { email?: string }).email;

  let checkout;
  try {
    checkout = await createCheckoutSession(order, email, input.returnTo ?? 'web');
  } catch (err) {
    console.error('[payments] could not create checkout session', err);
    // Release the reserved stock; nothing was charged.
    await cancelOrder(order.id, null, 'Payment could not be started', { system: true }).catch(() => undefined);
    throw new AppError(502, 'We could not start the payment. Please try again.');
  }

  order.payment = {
    checkoutSessionId: checkout.id,
    checkoutUrl: checkout.url ?? undefined,
    checkoutExpiresAt: new Date(checkout.expires_at * 1000),
  };
  await order.save();

  if (!checkout.url) throw new AppError(502, 'We could not start the payment. Please try again.');
  return { order: toOrderDTO(order), checkoutUrl: checkout.url };
}

/** Returns the still-open Stripe page for an unpaid order (e.g. the customer closed the tab). */
export async function resumeCheckout(orderId: string, customerId: string): Promise<{ checkoutUrl: string }> {
  const order = await OrderModel.findById(orderId);
  if (!order || orderCustomerId(order) !== customerId) throw AppError.notFound('Order not found');
  const p = order.payment;
  if (order.status !== 'Awaiting Payment' || !p?.checkoutUrl || !p.checkoutExpiresAt || p.checkoutExpiresAt <= new Date()) {
    throw AppError.conflict('This order can no longer be paid. Please place a new order.');
  }
  return { checkoutUrl: p.checkoutUrl };
}

async function restock(order: OrderDocument, session: ClientSession) {
  const changes: { id: string; stockQuantity: number }[] = [];
  for (const item of order.items) {
    const p = await ProductModel.findByIdAndUpdate(
      item.product,
      { $inc: { stockQuantity: item.quantity, soldCount: -item.quantity } },
      { new: true, session },
    );
    if (p) changes.push({ id: p.id, stockQuantity: p.stockQuantity });
  }
  return changes;
}

interface TransitionOptions {
  note?: string;
  guard?: (o: OrderDocument) => void;
  /** Extra fields written atomically with the status change. */
  set?: Record<string, unknown>;
  /** System (payment) transitions; only these may move an order out of "Awaiting Payment" into the kitchen. */
  system?: boolean;
}

/**
 * Moves an order to a new status. Uses the current status as an optimistic
 * lock so two admins clicking at once can't apply conflicting transitions.
 */
async function transition(orderId: string, to: OrderStatus, by: string | null, opts: TransitionOptions = {}): Promise<OrderDTO> {
  let updated!: OrderDocument;
  let from!: OrderStatus;
  let stockChanges: { id: string; stockQuantity: number }[] = [];

  await mongoose.connection.transaction(async (session) => {
    const current = await OrderModel.findById(orderId).session(session);
    if (!current) throw AppError.notFound('Order not found');
    opts.guard?.(current);

    if (!canTransition(current.status, to)) {
      throw AppError.conflict(`Cannot move order from "${current.status}" to "${to}"`);
    }
    if (current.status === 'Awaiting Payment' && to !== 'Cancelled' && !opts.system) {
      throw AppError.conflict('This order has not been paid yet');
    }

    const next = await OrderModel.findOneAndUpdate(
      { _id: orderId, status: current.status },
      {
        $set: { status: to, ...opts.set },
        $push: { statusHistory: { status: to, by: by ?? undefined, note: opts.note, at: new Date() } },
      },
      { new: true, session },
    );
    if (!next) throw AppError.conflict('Order was modified by someone else, please refresh');

    from = current.status;
    stockChanges = to === 'Cancelled' ? await restock(next, session) : [];
    updated = next;
  });

  await updated.populate('customer', CUSTOMER_FIELDS);
  const dto = toOrderDTO(updated);
  const wasUnpaid = from === 'Awaiting Payment';
  // A freshly paid order is "new" as far as the kitchen is concerned.
  if (wasUnpaid && to === 'Pending') broadcastOrderCreated(dto);
  // Don't push-notify about checkouts that were simply abandoned.
  broadcastOrderUpdated(dto, { notify: !(wasUnpaid && to === 'Cancelled') });
  for (const s of stockChanges) broadcastStockChanged(s.id, s.stockQuantity);
  return dto;
}

/**
 * Cancels an order, releasing its stock. Paid orders are refunded in full
 * first; unpaid orders have their Stripe page closed so it can't be paid.
 */
export async function cancelOrder(
  orderId: string,
  by: string | null,
  note: string,
  opts: Pick<TransitionOptions, 'guard' | 'system'> = {},
): Promise<OrderDTO> {
  const order = await OrderModel.findById(orderId);
  if (!order) throw AppError.notFound('Order not found');
  opts.guard?.(order);
  if (!canTransition(order.status, 'Cancelled')) {
    throw AppError.conflict(`Cannot cancel an order that is "${order.status}"`);
  }

  const set: Record<string, unknown> = {};
  if (order.paymentStatus === 'Paid' && order.payment?.paymentIntentId) {
    // Refund before cancelling: if Stripe refuses, the order stays as it was.
    const refund = await refundPayment(order.payment.paymentIntentId, order.id).catch((err) => {
      console.error('[payments] refund failed', err);
      throw new AppError(502, 'The refund could not be processed, so the order was not cancelled. Please try again.');
    });
    set.paymentStatus = 'Refunded';
    set['payment.refundId'] = refund.id;
  } else if (order.status === 'Awaiting Payment') {
    if (order.payment?.checkoutSessionId) await expireCheckoutSession(order.payment.checkoutSessionId);
    set.paymentStatus = 'Failed';
  }

  return transition(orderId, 'Cancelled', by, { note, set, guard: opts.guard, system: opts.system });
}

/** Called when Stripe confirms payment: the order goes to the kitchen. */
export function markPaid(orderId: string, paymentIntentId: string | null, amountReceived: number) {
  return transition(orderId, 'Pending', null, {
    system: true,
    note: 'Payment received',
    set: { paymentStatus: 'Paid', 'payment.paymentIntentId': paymentIntentId, 'payment.amountReceived': amountReceived },
  });
}

export function updateStatus(orderId: string, adminId: string, input: UpdateStatusInput) {
  if (input.status === 'Cancelled') return cancelOrder(orderId, adminId, input.note ?? 'Cancelled by the store');
  return transition(orderId, input.status, adminId, { note: input.note });
}

export function cancelByCustomer(orderId: string, customerId: string) {
  return cancelOrder(orderId, customerId, 'Cancelled by customer', {
    guard: (o) => {
      if (orderCustomerId(o) !== customerId) throw AppError.notFound('Order not found');
      if (o.status !== 'Pending' && o.status !== 'Awaiting Payment') {
        throw AppError.conflict('Orders can only be cancelled before they are confirmed');
      }
    },
  });
}

export async function updatePaymentStatus(orderId: string, paymentStatus: PaymentStatus): Promise<OrderDTO> {
  const order = await OrderModel.findByIdAndUpdate(orderId, { paymentStatus }, { new: true }).populate(
    'customer',
    CUSTOMER_FIELDS,
  );
  if (!order) throw AppError.notFound('Order not found');
  const dto = toOrderDTO(order);
  broadcastOrderUpdated(dto);
  return dto;
}

export async function getForUser(orderId: string, user: { id: string; role: Role }): Promise<OrderDTO> {
  const order = await OrderModel.findById(orderId).populate('customer', CUSTOMER_FIELDS);
  // 404 rather than 403 so order ids can't be probed.
  if (!order || (user.role !== 'admin' && orderCustomerId(order) !== user.id)) {
    throw AppError.notFound('Order not found');
  }
  return toOrderDTO(order);
}

async function paginate(filter: FilterQuery<Order>, page: number, limit: number): Promise<Paginated<OrderDTO>> {
  const [docs, total] = await Promise.all([
    OrderModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('customer', CUSTOMER_FIELDS),
    OrderModel.countDocuments(filter),
  ]);
  return { data: docs.map(toOrderDTO), page, limit, total, totalPages: Math.ceil(total / limit) };
}

export function listMine(customerId: string, input: ListOrdersInput) {
  return paginate({ customer: customerId, ...(input.status && { status: input.status }) }, input.page, input.limit);
}

export function listAll(input: ListOrdersInput) {
  return paginate(input.status ? { status: input.status } : {}, input.page, input.limit);
}
