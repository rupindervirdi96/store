import type { OrderDTO, OrderStatus } from '@store/shared';
import { api, ApiError } from './api';
import { confirm, notify } from './dialog';
import { formatPrice, shortId } from './format';

/** Moves an order to a new status, asking first when cancelling (and mentioning the refund). */
export async function moveOrder(order: OrderDTO, to: OrderStatus, token: string | null): Promise<OrderDTO | null> {
  if (to === 'Cancelled') {
    const refund = order.paymentStatus === 'Paid' ? ` ${formatPrice(order.totalAmount)} will be refunded to the customer's card.` : '';
    const ok = await confirm(`Cancel ${shortId(order.id)}?`, `Stock will be returned.${refund}`, 'Cancel order', true);
    if (!ok) return null;
  }
  try {
    return await api<OrderDTO>(`/orders/${order.id}/status`, { method: 'PATCH', body: { status: to }, token });
  } catch (e) {
    notify('Could not update order', e instanceof ApiError ? e.message : undefined);
    return null;
  }
}
