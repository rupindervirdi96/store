import { ORDER_PROGRESS, type OrderDTO } from '@store/shared';
import { formatDateTime } from '@/lib/format';

/** Vertical progress tracker driven by the order's statusHistory. */
export function OrderTimeline({ order }: { order: OrderDTO }) {
  if (order.status === 'Cancelled') {
    const at = order.statusHistory.findLast((e) => e.status === 'Cancelled')?.at;
    return (
      <div className="rounded-lg bg-rose-50 p-4 text-sm text-rose-800">
        This order was cancelled{at ? ` on ${formatDateTime(at)}` : ''}.
      </div>
    );
  }

  const reachedAt = new Map(order.statusHistory.map((e) => [e.status, e.at]));
  const currentIdx = ORDER_PROGRESS.indexOf(order.status);

  return (
    <ol className="relative space-y-6 border-l-2 border-slate-200 pl-6">
      {ORDER_PROGRESS.map((status, idx) => {
        const done = idx <= currentIdx;
        const current = idx === currentIdx;
        const at = reachedAt.get(status);
        return (
          <li key={status} className="relative">
            <span
              className={`absolute -left-[33px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white ${
                done ? 'bg-brand-600' : 'bg-slate-300'
              } ${current && status !== 'Delivered' ? 'animate-pulse' : ''}`}
            />
            <p className={`font-medium ${done ? 'text-slate-900' : 'text-slate-400'}`}>{status}</p>
            {at && <p className="text-xs text-slate-500">{formatDateTime(at)}</p>}
          </li>
        );
      })}
    </ol>
  );
}
