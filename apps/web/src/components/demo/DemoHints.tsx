'use client';

import { useDemo } from '@/store/demo';
import { Secret } from './CopyButton';
import { ResetDemoButton } from './DemoChrome';
import { useDemoSignIn } from './useDemoSignIn';

/** Inline hints on specific pages. Each renders nothing outside demo mode. */

export function DemoLoginHint({ next }: { next?: string | null }) {
  const info = useDemo((s) => s.info);
  const { signInAs, busy, error } = useDemoSignIn();
  if (!info) return null;
  return (
    <div className="space-y-3 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/60 p-4">
      <p className="text-sm font-semibold text-brand-900">Demo store — sign in with one click as:</p>
      <div className="grid grid-cols-2 gap-2">
        {info.accounts.map((a) => (
          <button
            key={a.role}
            type="button"
            className="btn-secondary"
            disabled={busy !== null}
            onClick={() => signInAs(a.role, next ?? undefined)}
          >
            {busy === a.role ? 'Signing in…' : a.role === 'admin' ? 'Admin (owner)' : 'Customer'}
          </button>
        ))}
      </div>
      <p className="text-xs text-stone-600">
        Password for both: <span className="font-mono">{info.accounts[0]?.password}</span>
      </p>
      {error && <p className="text-xs text-rose-700">{error}</p>}
    </div>
  );
}

export function DemoCardHint() {
  const info = useDemo((s) => s.info);
  if (!info) return null;
  return (
    <div className="space-y-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-50/60 p-3">
      <p className="text-sm font-semibold text-brand-900">Demo — pay with a test card</p>
      <Secret label={info.testCards[0].label} value={info.testCards[0].number} />
      <p className="text-xs text-stone-600">{info.cardHint} No money is charged.</p>
    </div>
  );
}

export function DemoAdminHint() {
  const info = useDemo((s) => s.info);
  if (!info) return null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-dashed border-brand-200 bg-brand-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-stone-700">
        <strong className="text-brand-900">Demo tip:</strong> open the store in another window, place an order with the test card, and watch it
        appear here instantly.
      </p>
      <ResetDemoButton />
    </div>
  );
}
