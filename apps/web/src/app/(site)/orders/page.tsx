'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { OrderDTO, Paginated } from '@store/shared';
import { RequireAuth } from '@/components/RequireAuth';
import { StatusBadge } from '@/components/StatusBadge';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { api } from '@/lib/api';
import { formatDateTime, formatPrice, shortId } from '@/lib/format';
import { useAuth } from '@/store/auth';

function OrdersList() {
  const token = useAuth((s) => s.token);
  const [orders, setOrders] = useState<OrderDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Paginated<OrderDTO>>('/orders/mine?limit=50', { token })
      .then((r) => setOrders(r.data))
      .catch((e: Error) => setError(e.message));
  }, [token]);

  useEffect(load, [load]);

  // Statuses update in place as the store progresses the order.
  useSocketEvent('order:updated', (updated) =>
    setOrders((prev) => prev?.map((o) => (o.id === updated.id ? updated : o)) ?? prev),
  );

  if (error) return <p className="text-rose-600">{error}</p>;
  if (!orders) return <p className="text-stone-500">Loading…</p>;
  if (orders.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="mb-4 text-stone-500">You haven&apos;t placed any orders yet.</p>
        <Link href="/shop" className="btn-primary">
          Browse the menu
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Your orders</h1>
      <ul className="card divide-y divide-stone-100">
        {orders.map((o) => (
          <li key={o.id}>
            <Link href={`/orders/${o.id}`} className="flex items-center justify-between gap-4 p-4 hover:bg-stone-50">
              <div>
                <p className="font-medium">{shortId(o.id)}</p>
                <p className="text-sm text-stone-500">
                  {formatDateTime(o.createdAt)} · {o.items.reduce((n, i) => n + i.quantity, 0)} items
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-medium tabular-nums">{formatPrice(o.totalAmount)}</span>
                <StatusBadge status={o.status} />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireAuth>
      <OrdersList />
    </RequireAuth>
  );
}
