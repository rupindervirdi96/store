'use client';

import type { StoreInfoDTO, StoreStatusDTO } from '@store/shared';
import { useStoreInfo } from '@/hooks/useStoreInfo';

const DOT: Record<StoreStatusDTO['reason'], string> = {
  open: 'bg-emerald-400',
  hours: 'bg-stone-400',
  closure: 'bg-rose-400',
  paused: 'bg-amber-400',
};

/** "● Open now · Closes at 10:00 pm". `tone="dark"` for use over photos / dark backgrounds. */
export function StoreStatusBadge({ initial, tone = 'light' }: { initial?: StoreInfoDTO | null; tone?: 'light' | 'dark' }) {
  const info = useStoreInfo(initial ?? null);
  if (!info) return null;
  const { status } = info;
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium ${
        tone === 'dark' ? 'bg-white/10 text-white backdrop-blur' : 'bg-stone-100 text-stone-700'
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${DOT[status.reason]} ${status.isOpen ? 'animate-pulse' : ''}`} />
      <span className="font-semibold">{status.headline}</span>
      <span className={tone === 'dark' ? 'text-stone-300' : 'text-stone-500'}>· {status.detail}</span>
    </span>
  );
}

/** Shown on cart/checkout when orders can't be placed. Renders nothing while open. */
export function ClosedNotice({ info }: { info: StoreInfoDTO | null }) {
  if (!info || info.status.isOpen) return null;
  const { status } = info;
  return (
    <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
      <p className="font-semibold">
        {status.reason === 'paused' ? 'Online ordering is paused' : "We're closed right now"}
      </p>
      <p className="text-amber-800">
        {status.opensAt ? `${status.detail}.` : 'Please check back soon.'} Your cart is saved, so you can check out
        once we&apos;re open.
      </p>
    </div>
  );
}
