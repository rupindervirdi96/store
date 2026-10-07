'use client';

import { useState } from 'react';

export function CopyButton({ value, label = 'Copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value.replace(/\s/g, ''));
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        } catch {
          /* clipboard blocked — the value is visible anyway */
        }
      }}
      className="shrink-0 rounded-md border border-stone-300 bg-white px-2 py-0.5 text-xs font-medium text-stone-600 hover:bg-stone-100"
    >
      {copied ? 'Copied ✓' : label}
    </button>
  );
}

/** A monospace value with a copy button, e.g. a password or card number. */
export function Secret({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-stone-200">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">{label}</p>
        <p className="truncate font-mono text-sm">{value}</p>
      </div>
      <CopyButton value={value} />
    </div>
  );
}
