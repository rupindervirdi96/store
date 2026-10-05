import { SOCKET_EVENTS, type OrderDTO } from '@store/shared';
import { getIO, rooms } from '../../realtime/socket';
import { sendPushToUser } from '../notifications/push.service';

function customerIdOf(order: OrderDTO): string {
  return typeof order.customer === 'string' ? order.customer : order.customer.id;
}

const PUSH_COPY: Partial<Record<OrderDTO['status'], string>> = {
  Confirmed: 'Your order has been confirmed.',
  Preparing: 'Your order is being prepared.',
  'Out for Delivery': 'Your order is out for delivery!',
  Delivered: 'Your order has been delivered. Enjoy!',
  Cancelled: 'Your order has been cancelled.',
};

/** New order: only the operations board needs to know. */
export function broadcastOrderCreated(order: OrderDTO): void {
  getIO().to(rooms.admins).emit(SOCKET_EVENTS.ORDER_CREATED, order);
}

/**
 * Status/payment change: fan out to all admins and every connected device of
 * the owning customer in a single emit (Socket.io de-duplicates sockets that
 * are in both rooms), then fire a push notification for backgrounded apps.
 */
export function broadcastOrderUpdated(order: OrderDTO): void {
  getIO()
    .to([rooms.admins, rooms.user(customerIdOf(order))])
    .emit(SOCKET_EVENTS.ORDER_UPDATED, order);

  const body = PUSH_COPY[order.status];
  if (body) {
    // Fire-and-forget: a push failure must never fail the status update.
    void sendPushToUser(customerIdOf(order), {
      title: `Order #${order.id.slice(-6).toUpperCase()}`,
      body,
      data: { orderId: order.id, status: order.status },
    });
  }
}

export function broadcastStockChanged(productId: string, stockQuantity: number): void {
  getIO().to(rooms.admins).emit(SOCKET_EVENTS.PRODUCT_STOCK_CHANGED, { id: productId, stockQuantity });
}
