import mongoose, { type ClientSession, type FilterQuery } from 'mongoose';
import { canTransition, type OrderDTO, type OrderStatus, type Paginated, type PaymentStatus, type Role } from '@store/shared';
import { AppError } from '../../utils/AppError';
import { ProductModel } from '../products/product.model';
import { broadcastOrderCreated, broadcastOrderUpdated, broadcastStockChanged } from './order.events';
import { OrderModel, orderCustomerId, toOrderDTO, type Order, type OrderDocument } from './order.model';
import type { CreateOrderInput, ListOrdersInput, UpdateStatusInput } from './order.schemas';

const CUSTOMER_FIELDS = 'name email';
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Places an order inside a MongoDB transaction:
 *  1. Atomically decrement stock for each line (fails if insufficient).
 *  2. Snapshot title/price/image from the DB — client prices are never trusted.
 *  3. Persist the order.
 * Any failure rolls back every stock decrement.
 */
export async function createOrder(customerId: string, input: CreateOrderInput): Promise<OrderDTO> {
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
        { $inc: { stockQuantity: -quantity } },
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
          status: 'Pending',
          statusHistory: [{ status: 'Pending', by: customerId }],
          paymentStatus: 'Pending',
        },
      ],
      { session },
    );
  });

  // Broadcast only after commit so clients never see rolled-back state.
  await order.populate('customer', CUSTOMER_FIELDS);
  const dto = toOrderDTO(order);
  broadcastOrderCreated(dto);
  for (const s of stockChanges) broadcastStockChanged(s.id, s.stockQuantity);
  return dto;
}

async function restock(order: OrderDocument, session: ClientSession) {
  const changes: { id: string; stockQuantity: number }[] = [];
  for (const item of order.items) {
    const p = await ProductModel.findByIdAndUpdate(
      item.product,
      { $inc: { stockQuantity: item.quantity } },
      { new: true, session },
    );
    if (p) changes.push({ id: p.id, stockQuantity: p.stockQuantity });
  }
  return changes;
}

/**
 * Moves an order to a new status. Uses the current status as an optimistic
 * lock so two admins clicking at once can't apply conflicting transitions.
 */
async function transition(
  orderId: string,
  to: OrderStatus,
  by: string,
  note?: string,
  guard?: (o: OrderDocument) => void,
): Promise<OrderDTO> {
  let updated!: OrderDocument;
  let stockChanges: { id: string; stockQuantity: number }[] = [];

  await mongoose.connection.transaction(async (session) => {
    const current = await OrderModel.findById(orderId).session(session);
    if (!current) throw AppError.notFound('Order not found');
    guard?.(current);

    if (!canTransition(current.status, to)) {
      throw AppError.conflict(`Cannot move order from "${current.status}" to "${to}"`);
    }

    const next = await OrderModel.findOneAndUpdate(
      { _id: orderId, status: current.status },
      { $set: { status: to }, $push: { statusHistory: { status: to, by, note, at: new Date() } } },
      { new: true, session },
    );
    if (!next) throw AppError.conflict('Order was modified by someone else, please refresh');

    stockChanges = to === 'Cancelled' ? await restock(next, session) : [];
    updated = next;
  });

  await updated.populate('customer', CUSTOMER_FIELDS);
  const dto = toOrderDTO(updated);
  broadcastOrderUpdated(dto);
  for (const s of stockChanges) broadcastStockChanged(s.id, s.stockQuantity);
  return dto;
}

export function updateStatus(orderId: string, adminId: string, input: UpdateStatusInput) {
  return transition(orderId, input.status, adminId, input.note);
}

export function cancelByCustomer(orderId: string, customerId: string) {
  return transition(orderId, 'Cancelled', customerId, 'Cancelled by customer', (o) => {
    if (orderCustomerId(o) !== customerId) throw AppError.notFound('Order not found');
    if (o.status !== 'Pending') {
      throw AppError.conflict('Orders can only be cancelled before they are confirmed');
    }
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
