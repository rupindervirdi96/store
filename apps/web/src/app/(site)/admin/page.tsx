'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ORDER_STATUS_TRANSITIONS,
  type OrderDTO,
  type OrderStatus,
  type Paginated,
} from '@store/shared';
import { useSocketEvent, useSocketStatus } from '@/hooks/useSocketEvent';
import { api, ApiError } from '@/lib/api';
import { formatPrice, shortId } from '@/lib/format';
import { useAuth } from '@/store/auth';

const ACTIVE_COLUMNS: OrderStatus[] = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery'];
const DONE_COLUMN_LIMIT = 15;

const COLUMN_ACCENT: Record<OrderStatus, string> = {
  'Awaiting Payment': 'border-t-stone-300',
  Pending: 'border-t-amber-400',
  Confirmed: 'border-t-sky-400',
  Preparing: 'border-t-indigo-400',
  'Out for Delivery': 'border-t-violet-400',
  Delivered: 'border-t-emerald-400',
  Cancelled: 'border-t-rose-400',
};

function minutesAgo(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  return m < 1 ? 'just now' : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ${m % 60}m ago`;
}

function without(set: Set<string>, id: string) {
  const next = new Set(set);
  next.delete(id);
  return next;
}

export default function OperationsBoard() {
  const token = useAuth((s) => s.token);
  const [orders, setOrders] = useState<Map<string, OrderDTO>>(new Map());
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [, tick] = useState(0);

  const load = useCallback(async () => {
    const lists = await Promise.all([
      ...ACTIVE_COLUMNS.map((s) =>
        api<Paginated<OrderDTO>>(`/orders?status=${encodeURIComponent(s)}&limit=200`, { token }),
      ),
      api<Paginated<OrderDTO>>(`/orders?status=Delivered&limit=${DONE_COLUMN_LIMIT}`, { token }),
    ]);
    setOrders(new Map(lists.flatMap((l) => l.data).map((o) => [o.id, o])));
    setLoading(false);
  }, [token]);

  useEffect(() => {
    void load();
    const t = setInterval(() => tick((n) => n + 1), 30_000); // refresh "x min ago"
    return () => clearInterval(t);
  }, [load]);

  const upsert = useCallback((o: OrderDTO, highlight = false) => {
    setOrders((prev) => new Map(prev).set(o.id, o));
    if (highlight) {
      setFlash((s) => new Set(s).add(o.id));
      setTimeout(() => setFlash((s) => without(s, o.id)), 4000);
    }
  }, []);

  // ── Real-time feed ────────────────────────────────────────────────
  useSocketEvent('order:created', (o) => upsert(o, true));
  useSocketEvent('order:updated', (o) => upsert(o));
  const live = useSocketStatus(() => void load());

  async function move(order: OrderDTO, status: OrderStatus) {
    if (
      status === 'Cancelled' &&
      !confirm(
        `Cancel order ${shortId(order.id)}? Stock will be returned` +
          (order.paymentStatus === 'Paid' ? ` and ${formatPrice(order.totalAmount)} refunded to the customer's card.` : '.'),
      )
    )
      return;
    setPending((s) => new Set(s).add(order.id));
    try {
      // The server echoes the change via `order:updated` to every admin
      // (including this one); applying the response too keeps it snappy.
      upsert(await api<OrderDTO>(`/orders/${order.id}/status`, { method: 'PATCH', body: { status }, token }));
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Update failed');
      void load();
    } finally {
      setPending((s) => without(s, order.id));
    }
  }

  const columns = useMemo(() => {
    const byStatus = new Map<OrderStatus, OrderDTO[]>();
    for (const o of orders.values()) {
      byStatus.set(o.status, [...(byStatus.get(o.status) ?? []), o]);
    }
    // Oldest first in active columns (FIFO fulfillment); newest first when done.
    const sorted = (s: OrderStatus, dir: 1 | -1) =>
      (byStatus.get(s) ?? []).sort((a, b) => dir * a.createdAt.localeCompare(b.createdAt));
    return [
      ...ACTIVE_COLUMNS.map((s) => ({ status: s, orders: sorted(s, 1) })),
      { status: 'Delivered' as const, orders: sorted('Delivered', -1).slice(0, DONE_COLUMN_LIMIT) },
    ];
  }, [orders]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Live operations</h1>
        <span className="flex items-center gap-2 text-sm text-stone-500">
          <span className={`h-2.5 w-2.5 rounded-full ${live ? 'animate-pulse bg-emerald-500' : 'bg-stone-300'}`} />
          {live ? 'Live' : 'Connecting…'}
        </span>
      </div>

      {loading ? (
        <p className="text-stone-500">Loading orders…</p>
      ) : (
        <div className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-4">
          {columns.map(({ status, orders: col }) => (
            <section
              key={status}
              className={`flex w-72 shrink-0 flex-col rounded-xl border-t-4 bg-stone-100 ${COLUMN_ACCENT[status]}`}
            >
              <header className="flex items-center justify-between px-3 py-2">
                <h2 className="text-sm font-semibold">{status}</h2>
                <span className="rounded-full bg-white px-2 text-xs font-medium text-stone-600">{col.length}</span>
              </header>
              <div className="flex flex-col gap-2 p-2">
                {col.map((o) => (
                  <article
                    key={o.id}
                    className={`card space-y-2 p-3 text-sm transition ${flash.has(o.id) ? 'ring-2 ring-amber-400' : ''} ${
                      pending.has(o.id) ? 'opacity-60' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{shortId(o.id)}</span>
                      <span className="text-xs text-stone-500">{minutesAgo(o.createdAt)}</span>
                    </div>
                    <p className="text-stone-600">
                      {typeof o.customer === 'string' ? 'Customer' : o.customer.name}
                    </p>
                    <ul className="text-xs text-stone-500">
                      {o.items.map((i) => (
                        <li key={i.product}>
                          {i.quantity} × {i.title}
                        </li>
                      ))}
                    </ul>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{formatPrice(o.totalAmount)}</span>
                      <span className="text-xs text-stone-500">{o.paymentStatus}</span>
                    </div>
                    {ORDER_STATUS_TRANSITIONS[o.status].length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {ORDER_STATUS_TRANSITIONS[o.status].map((next) => (
                          <button
                            key={next}
                            disabled={pending.has(o.id)}
                            onClick={() => move(o, next)}
                            className={
                              next === 'Cancelled'
                                ? 'btn px-2 py-1 text-xs text-rose-600 hover:bg-rose-50'
                                : 'btn-primary flex-1 px-2 py-1 text-xs'
                            }
                          >
                            {next === 'Cancelled' ? 'Cancel' : `→ ${next}`}
                          </button>
                        ))}
                      </div>
                    )}
                  </article>
                ))}
                {col.length === 0 && <p className="py-6 text-center text-xs text-stone-400">No orders</p>}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
