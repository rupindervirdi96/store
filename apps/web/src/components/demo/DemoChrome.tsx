'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError, refreshStorefront } from '@/lib/api';
import { useHydrated } from '@/hooks/useHydrated';
import { useAuth } from '@/store/auth';
import { useCart } from '@/store/cart';
import { useDemo } from '@/store/demo';
import { Secret } from './CopyButton';
import { useDemoSignIn } from './useDemoSignIn';

const SEEN_KEY = 'demo-guide-seen';

/** Banner + floating "Demo guide" button + guide panel. Renders nothing outside demo mode. */
export function DemoChrome() {
  const hydrated = useHydrated();
  const { info, guideOpen, load, setGuideOpen } = useDemo();

  useEffect(() => {
    void load();
  }, [load]);

  // Open the guide automatically on someone's first visit.
  useEffect(() => {
    if (!info) return;
    try {
      if (!localStorage.getItem(SEEN_KEY)) {
        localStorage.setItem(SEEN_KEY, '1');
        setGuideOpen(true);
      }
    } catch {
      /* storage unavailable */
    }
  }, [info, setGuideOpen]);

  useEffect(() => {
    if (!guideOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setGuideOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [guideOpen, setGuideOpen]);

  if (!hydrated || !info) return null;

  return (
    <>
      <div className="bg-ink text-white">
        <div className="container-page flex flex-wrap items-center justify-center gap-x-3 gap-y-1 py-2 text-center text-sm">
          <span>
            <span className="mr-2 rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wider">Demo</span>
            This is a demo store — explore freely, nothing here is real.
          </span>
          <button onClick={() => setGuideOpen(true)} className="font-semibold text-brand-400 underline-offset-2 hover:underline">
            How to explore →
          </button>
        </div>
      </div>

      {!guideOpen && (
        <button
          onClick={() => setGuideOpen(true)}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white shadow-xl shadow-ink/30 transition hover:bg-stone-800"
        >
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-xs">?</span>
          Demo guide
        </button>
      )}

      {guideOpen && <DemoGuide onClose={() => setGuideOpen(false)} />}
    </>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 font-display text-base font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{n}</span>
        {title}
      </h3>
      <div className="space-y-2 pl-8 text-sm text-stone-600">{children}</div>
    </section>
  );
}

function DemoGuide({ onClose }: { onClose: () => void }) {
  const info = useDemo((s) => s.info)!;
  const user = useAuth((s) => s.user);
  const { signInAs, busy, error } = useDemoSignIn();
  const customer = info.accounts.find((a) => a.role === 'customer');
  const admin = info.accounts.find((a) => a.role === 'admin');

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-ink/40" onClick={onClose} role="dialog" aria-modal="true" aria-label="Demo guide">
      <aside
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-md flex-col overflow-y-auto bg-cream shadow-2xl"
      >
        <header className="sticky top-0 flex items-start justify-between gap-4 border-b border-stone-200 bg-cream/95 p-5 backdrop-blur">
          <div>
            <p className="eyebrow">Demo guide</p>
            <h2 className="text-2xl font-bold">Take the 2-minute tour</h2>
            <p className="mt-1 text-sm text-stone-500">Everything is test data. Orders are not real and no money is charged.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-stone-500 hover:bg-stone-200" aria-label="Close guide">
            ✕
          </button>
        </header>

        <div className="space-y-7 p-5">
          <Step n={1} title="Browse the menu">
            <p>Check out the special offers on the home page, filter by category, and add a few items to your cart.</p>
            <Link href="/shop" onClick={onClose} className="btn-secondary">
              Open the menu
            </Link>
          </Step>

          {customer && (
            <Step n={2} title="Sign in as a customer">
              <Secret label="Email" value={customer.email} />
              <Secret label="Password" value={customer.password} />
              <button className="btn-primary w-full" disabled={busy !== null} onClick={() => signInAs('customer', '/cart')}>
                {busy === 'customer' ? 'Signing in…' : 'Sign in as customer'}
              </button>
              <p className="text-xs">Or create your own account — any email works.</p>
            </Step>
          )}

          <Step n={3} title="Check out with a test card">
            {info.testCards.map((c) => (
              <Secret key={c.number} label={c.label} value={c.number} />
            ))}
            <p className="text-xs">{info.cardHint}</p>
            <p>After paying you land on live order tracking — leave it open for step 4.</p>
          </Step>

          {admin && (
            <Step n={4} title="Run the shop as the owner">
              <p>
                Open the site in a <strong>second window</strong> (or on your phone) and sign in as admin. New paid orders appear on the
                live board instantly — move them along and watch the customer&apos;s tracking page update in real time.
              </p>
              <Secret label="Admin email" value={admin.email} />
              <Secret label="Admin password" value={admin.password} />
              <button className="btn-primary w-full" disabled={busy !== null} onClick={() => signInAs('admin')}>
                {busy === 'admin' ? 'Signing in…' : 'Sign in as admin'}
              </button>
              <p>In the admin you can also edit menu items, upload photos, put items on offer and reorder categories.</p>
            </Step>
          )}

          {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}

          {user?.role === 'admin' && (
            <section className="rounded-2xl border border-stone-200 bg-white p-4">
              <h3 className="font-display font-semibold">Reset the demo</h3>
              <p className="mt-1 text-sm text-stone-500">Removes all orders and sign-ups and restores the original menu.</p>
              <div className="mt-3">
                <ResetDemoButton />
              </div>
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

export function ResetDemoButton() {
  const token = useAuth((s) => s.token);
  const clearCart = useCart((s) => s.clear);
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');

  async function reset() {
    if (!confirm('Reset the demo? All orders and sign-ups are removed and the menu is restored.')) return;
    setState('busy');
    try {
      await api('/demo/reset', { method: 'POST', token });
      clearCart();
      refreshStorefront(token);
      setState('done');
      setTimeout(() => window.location.reload(), 600);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Reset failed');
      setState('idle');
    }
  }

  return (
    <button className="btn-secondary text-rose-600" onClick={reset} disabled={state !== 'idle'}>
      {state === 'busy' ? 'Resetting…' : state === 'done' ? 'Done ✓' : 'Reset demo data'}
    </button>
  );
}
