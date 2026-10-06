'use client';

import type { ReactNode } from 'react';

/** Small building blocks shared by the admin screens. */

export function Panel({ title, description, children, aside }: { title: string; description?: string; children?: ReactNode; aside?: ReactNode }) {
  return (
    <section className="card space-y-5 p-5 sm:p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-base font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-stone-500">{description}</p>}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Field({ label, hint, children, error }: { label: string; hint?: ReactNode; children: ReactNode; error?: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      {children}
      {error ? <span className="block text-xs text-rose-600">{error}</span> : hint && <span className="block text-xs text-stone-500">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-emerald-500' : 'bg-stone-300'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-5.5' : 'left-0.5'}`} />
    </button>
  );
}

export function Badge({ tone = 'stone', children }: { tone?: 'stone' | 'rose' | 'amber' | 'emerald'; children: ReactNode }) {
  const tones = {
    stone: 'bg-stone-100 text-stone-600',
    rose: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-800',
    emerald: 'bg-emerald-100 text-emerald-700',
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${tones[tone]}`}>{children}</span>;
}
