import { Schema, model, Types, type HydratedDocument, type InferSchemaType } from 'mongoose';
import { ORDER_STATUSES, PAYMENT_STATUSES, type OrderDTO } from '@store/shared';
import { resolveImage } from '../media/media.service';
import { AddressSchema } from '../users/user.model';

/**
 * Items are snapshots: title/price/image are copied at purchase time so that
 * later catalog edits never rewrite order history or invoices.
 */
const OrderItemSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    title: { type: String, required: true },
    image: { type: String },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const StatusEventSchema = new Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    at: { type: Date, default: Date.now },
    by: { type: Schema.Types.ObjectId, ref: 'User' },
    note: { type: String },
  },
  { _id: false },
);

const OrderSchema = new Schema(
  {
    customer: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: {
      type: [OrderItemSchema],
      validate: [(v: unknown[]) => v.length > 0, 'Order must contain at least one item'],
    },
    totalAmount: { type: Number, required: true, min: 0 },
    shippingAddress: { type: AddressSchema, required: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'Pending' },
    statusHistory: { type: [StatusEventSchema], default: [] },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'Pending' },
  },
  { timestamps: true },
);

// "My orders" page.
OrderSchema.index({ customer: 1, createdAt: -1 });
// Admin operations board: filter by status, newest first.
OrderSchema.index({ status: 1, createdAt: -1 });

export type Order = InferSchemaType<typeof OrderSchema>;
export type OrderDocument = HydratedDocument<Order>;

export function toOrderDTO(o: OrderDocument): OrderDTO {
  const c = o.customer as unknown;
  const customer =
    c instanceof Types.ObjectId
      ? c.toString()
      : (() => {
          const u = c as { _id: Types.ObjectId; name: string; email: string };
          return { id: u._id.toString(), name: u.name, email: u.email };
        })();

  return {
    id: o.id,
    customer,
    items: o.items.map((i) => ({
      product: i.product.toString(),
      title: i.title,
      image: resolveImage(i.image),
      price: i.price,
      quantity: i.quantity,
    })),
    totalAmount: o.totalAmount,
    shippingAddress: {
      label: o.shippingAddress.label ?? undefined,
      line1: o.shippingAddress.line1,
      line2: o.shippingAddress.line2 ?? undefined,
      city: o.shippingAddress.city,
      state: o.shippingAddress.state,
      postalCode: o.shippingAddress.postalCode,
      country: o.shippingAddress.country,
      phone: o.shippingAddress.phone ?? undefined,
    },
    status: o.status,
    statusHistory: o.statusHistory.map((e) => ({
      status: e.status,
      at: e.at.toISOString(),
      note: e.note ?? undefined,
    })),
    paymentStatus: o.paymentStatus,
    createdAt: o.createdAt.toISOString(),
    updatedAt: o.updatedAt.toISOString(),
  };
}

/** Customer id regardless of whether `customer` has been populated. */
export function orderCustomerId(o: OrderDocument): string {
  const c = o.customer as unknown;
  return c instanceof Types.ObjectId ? c.toString() : (c as { _id: Types.ObjectId })._id.toString();
}

export const OrderModel = model('Order', OrderSchema);
