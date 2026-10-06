'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { OrderDTO } from '@store/shared';
import { OrderTimeline } from '@/components/OrderTimeline';
import { RequireAuth } from '@/components/RequireAuth';
import { StatusBadge } from '@/components/StatusBadge';
import { useSocketEvent, useSocketStatus } from '@/hooks/useSocketEvent';
import { api, ApiError } from '@/lib/api';
import { formatDateTime, formatPrice, shortId } from '@/lib/format';
import { useAuth } from '@/store/auth';

function OrderTracking({ id }: { id: string }) {
  const token = useAuth((s) => s.token);
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    api<OrderDTO>(`/orders/${id}`, { token })
      .then(setOrder)
      .catch((e: Error) => setError(e.message));
  }, [id, token]);

  useEffect(load, [load]);

  // Live updates: the server pushes to this customer's private room.
  useSocketEvent('order:updated', (updated) => {
    if (updated.id === id) setOrder(updated);
  });
  // If the socket was offline long enough to miss events, refetch.
  const live = useSocketStatus(load);

  async function cancel() {
    if (!confirm('Cancel this order?')) return;
    setCancelling(true);
    try {
      setOrder(await api<OrderDTO>(`/orders/${id}/cancel`, { method: 'POST', token }));
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Could not cancel order');
    } finally {
      setCancelling(false);
    }
  }

  if (error) return <p className="text-rose-600">{error}</p>;
  if (!order) return <p className="text-stone-500">Loading…</p>;

  return (
    <div className="space-y-6">
      <Link href="/orders" className="text-sm text-stone-500 hover:text-stone-800">
        ← All orders
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Order {shortId(order.id)}</h1>
          <p className="text-sm text-stone-500">Placed {formatDateTime(order.createdAt)}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-xs text-stone-500">
            <span className={`h-2 w-2 rounded-full ${live ? 'bg-emerald-500' : 'bg-stone-300'}`} />
            {live ? 'Live' : 'Reconnecting…'}
          </span>
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
        <section className="card p-6">
          <h2 className="mb-6 font-semibold">Tracking</h2>
          <OrderTimeline order={order} />
          {order.status === 'Pending' && (
            <button className="btn-secondary mt-8 text-rose-600" onClick={cancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Cancel order'}
            </button>
          )}
        </section>

        <section className="card space-y-4 p-6">
          <h2 className="font-semibold">Items</h2>
          <ul className="space-y-2 text-sm">
            {order.items.map((i) => (
              <li key={i.product} className="flex justify-between gap-2">
                <span>
                  {i.quantity} × {i.title}
                </span>
                <span className="tabular-nums">{formatPrice(i.price * i.quantity)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-between border-t border-stone-100 pt-3 font-semibold">
            <span>Total</span>
            <span>{formatPrice(order.totalAmount)}</span>
          </div>
          <div className="text-sm text-stone-600">
            <p className="font-medium text-stone-900">Delivering to</p>
            <p>{order.shippingAddress.line1}</p>
            {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
            <p>
              {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}
            </p>
          </div>
          <p className="text-sm text-stone-500">Payment: {order.paymentStatus}</p>
        </section>
      </div>
    </div>
  );
}

export default function OrderPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <OrderTracking id={id} />
    </RequireAuth>
  );
}
