import { z } from 'zod';
import { ORDER_STATUSES, PAYMENT_STATUSES } from '@store/shared';
import { objectId } from '../../middleware/validate';
import { AddressInput } from '../users/user.schemas';

export const CreateOrderSchema = z.object({
  items: z
    .array(z.object({ productId: objectId, quantity: z.number().int().min(1).max(99) }))
    .min(1)
    .max(50),
  shippingAddress: AddressInput,
});

export const UpdateStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: z.string().trim().max(500).optional(),
});

export const UpdatePaymentSchema = z.object({
  paymentStatus: z.enum(PAYMENT_STATUSES),
});

export const ListOrdersQuery = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
export type UpdateStatusInput = z.infer<typeof UpdateStatusSchema>;
export type ListOrdersInput = z.infer<typeof ListOrdersQuery>;
