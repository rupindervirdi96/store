'use client';

import { useEffect, useState } from 'react';
import {
  DATE_PATTERN,
  PAUSE_DURATIONS,
  PAUSE_LABELS,
  TIMEZONES,
  TIME_PATTERN,
  WEEKDAYS,
  WEEKDAY_NAMES,
  formatClosureDate,
  formatTime,
  type Closure,
  type DayHours,
  type PauseDuration,
  type StoreInfoDTO,
  type Weekday,
} from '@store/shared';
import { api, ApiError, refreshStorefront } from '@/lib/api';
import { useAuth } from '@/store/auth';

type Draft = { timezone: string; weekly: Record<Weekday, DayHours>; closures: Closure[] };

const toDraft = (info: StoreInfoDTO): Draft => ({
  timezone: info.hours.timezone,
  weekly: info.hours.weekly,
  closures: info.hours.closures,
});

export default function HoursPage() {
  const token = useAuth((s) => s.token);
  const [info, setInfo] = useState<StoreInfoDTO | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newClosure, setNewClosure] = useState<Closure>({ date: '', note: '' });

  useEffect(() => {
    api<StoreInfoDTO>('/store', { cache: 'no-store' })
      .then((i) => {
        setInfo(i);
        setDraft(toDraft(i));
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  if (!draft || !info) {
    return error ? <p className="text-rose-700">{error}</p> : <p className="text-stone-500">Loading…</p>;
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(info));
  const dayError = (d: DayHours) =>
    d.closed
      ? null
      : !TIME_PATTERN.test(d.open) || !TIME_PATTERN.test(d.close)
        ? 'Enter both times'
        : d.open === d.close
          ? 'Opening and closing times must differ'
          : null;
  const hasErrors = WEEKDAYS.some((d) => dayError(draft.weekly[d]));

  const setDay = (day: Weekday, patch: Partial<DayHours>) =>
    setDraft({ ...draft, weekly: { ...draft.weekly, [day]: { ...draft.weekly[day], ...patch } } });

  function copyToAll(from: Weekday) {
    setDraft({ ...draft!, weekly: Object.fromEntries(WEEKDAYS.map((d) => [d, { ...draft!.weekly[from] }])) as Draft['weekly'] });
  }

  async function run(fn: () => Promise<StoreInfoDTO>, after?: () => void) {
    setError(null);
    setSaved(false);
    try {
      const next = await fn();
      setInfo(next);
      after?.();
      refreshStorefront(token);
      return next;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
      return null;
    }
  }

  async function save() {
    setSaving(true);
    const next = await run(() => api<StoreInfoDTO>('/store/hours', { method: 'PUT', body: draft, token }));
    if (next) {
      setDraft(toDraft(next));
      setSaved(true);
    }
    setSaving(false);
  }

  async function pause(duration: PauseDuration) {
    setBusy(true);
    await run(() => api<StoreInfoDTO>('/store/pause', { method: 'POST', body: { duration }, token }));
    setBusy(false);
  }

  async function resume() {
    setBusy(true);
    await run(() => api<StoreInfoDTO>('/store/pause', { method: 'DELETE', token }));
    setBusy(false);
  }

  function addClosure() {
    if (!DATE_PATTERN.test(newClosure.date)) return;
    const others = draft!.closures.filter((c) => c.date !== newClosure.date);
    const note = newClosure.note?.trim();
    setDraft({
      ...draft!,
      closures: [...others, { date: newClosure.date, ...(note && { note }) }].sort((a, b) => a.date.localeCompare(b.date)),
    });
    setNewClosure({ date: '', note: '' });
  }

  const { status } = info;
  const today = new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        {/* ── Weekly schedule ─────────────────────────────── */}
        <section className="card space-y-4 p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold">Weekly hours</h1>
              <p className="text-sm text-stone-500">
                Customers can only place orders during these hours. A closing time earlier than the opening time
                runs past midnight.
              </p>
            </div>
          </div>

          <div className="divide-y divide-stone-100">
            {WEEKDAYS.map((day) => {
              const d = draft.weekly[day];
              const err = dayError(d);
              const overnight = !d.closed && TIME_PATTERN.test(d.open) && TIME_PATTERN.test(d.close) && d.close < d.open;
              return (
                <div key={day} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                  <span className="w-28 font-medium">{WEEKDAY_NAMES[day]}</span>
                  <label className="flex items-center gap-2 text-sm text-stone-600">
                    <input
                      type="checkbox"
                      checked={!d.closed}
                      onChange={(e) => setDay(day, { closed: !e.target.checked })}
                      className="h-4 w-4 accent-brand-600"
                    />
                    Open
                  </label>
                  {d.closed ? (
                    <span className="text-sm text-stone-400">Closed all day</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={d.open}
                        onChange={(e) => setDay(day, { open: e.target.value })}
                        className="input w-32"
                        aria-label={`${WEEKDAY_NAMES[day]} opening time`}
                      />
                      <span className="text-stone-400">to</span>
                      <input
                        type="time"
                        value={d.close}
                        onChange={(e) => setDay(day, { close: e.target.value })}
                        className="input w-32"
                        aria-label={`${WEEKDAY_NAMES[day]} closing time`}
                      />
                      {overnight && <span className="text-xs text-stone-500">(next day)</span>}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => copyToAll(day)}
                    className="ml-auto text-xs font-medium text-brand-700 hover:underline"
                  >
                    Copy to all days
                  </button>
                  {err && <p className="w-full text-xs text-rose-600">{err}</p>}
                </div>
              );
            })}
          </div>

          <label className="block max-w-sm space-y-1 text-sm">
            <span className="text-stone-600">Time zone</span>
            <select
              value={draft.timezone}
              onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
              className="input"
            >
              {!TIMEZONES.some((t) => t.id === draft.timezone) && <option value={draft.timezone}>{draft.timezone}</option>}
              {TIMEZONES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        {/* ── Closures ─────────────────────────────────────── */}
        <section className="card space-y-4 p-6">
          <div>
            <h2 className="text-lg font-semibold">Holidays and special closures</h2>
            <p className="text-sm text-stone-500">Closed all day on these dates. Shown on the website ahead of time.</p>
          </div>

          {draft.closures.length > 0 ? (
            <ul className="divide-y divide-stone-100">
              {draft.closures.map((c) => (
                <li key={c.date} className="flex items-center gap-3 py-2 text-sm">
                  <span className={`w-28 font-medium ${c.date < today ? 'text-stone-400 line-through' : ''}`}>
                    {formatClosureDate(c.date)}
                  </span>
                  <span className="flex-1 text-stone-600">{c.note}</span>
                  <button
                    type="button"
                    onClick={() => setDraft({ ...draft, closures: draft.closures.filter((x) => x.date !== c.date) })}
                    className="text-xs font-medium text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-stone-400">No closures planned.</p>
          )}

          <div className="flex flex-wrap items-end gap-2">
            <label className="space-y-1 text-sm">
              <span className="text-stone-600">Date</span>
              <input
                type="date"
                min={today}
                value={newClosure.date}
                onChange={(e) => setNewClosure({ ...newClosure, date: e.target.value })}
                className="input w-44"
              />
            </label>
            <label className="min-w-48 flex-1 space-y-1 text-sm">
              <span className="text-stone-600">Note (optional)</span>
              <input
                value={newClosure.note ?? ''}
                maxLength={80}
                onChange={(e) => setNewClosure({ ...newClosure, note: e.target.value })}
                placeholder="Christmas Day"
                className="input"
              />
            </label>
            <button type="button" onClick={addClosure} disabled={!DATE_PATTERN.test(newClosure.date)} className="btn-secondary">
              Add closure
            </button>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={!dirty || hasErrors || saving} className="btn-primary px-8">
            {saving ? 'Saving…' : 'Save hours'}
          </button>
          {dirty && (
            <button type="button" onClick={() => setDraft(toDraft(info))} className="btn-secondary">
              Discard changes
            </button>
          )}
          {saved && !dirty && <span className="text-sm font-medium text-emerald-700">Saved. The website is updated.</span>}
          {error && <span className="text-sm text-rose-700">{error}</span>}
        </div>
      </div>

      {/* ── Live status + pause ─────────────────────────────── */}
      <aside className="card h-fit space-y-4 p-6 lg:sticky lg:top-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">Right now</p>
          <p
            className={`mt-1 text-2xl font-bold ${
              status.isOpen ? 'text-emerald-700' : status.reason === 'paused' ? 'text-amber-700' : 'text-stone-800'
            }`}
          >
            {status.headline}
          </p>
          <p className="text-sm text-stone-600">{status.detail}</p>
        </div>

        {info.hours.paused ? (
          <div className="space-y-2">
            <p className="text-sm text-stone-600">
              {info.hours.pausedUntil
                ? `Orders resume automatically at ${formatTime(
                    new Date(info.hours.pausedUntil).toLocaleTimeString('en-GB', {
                      timeZone: info.hours.timezone,
                      hour: '2-digit',
                      minute: '2-digit',
                    }),
                  )}.`
                : 'Orders stay paused until you resume them.'}
            </p>
            <button onClick={resume} disabled={busy} className="btn-primary w-full">
              Resume orders now
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-stone-600">
              Kitchen swamped or closing early? Pause online orders. Customers see when you&apos;ll be back.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PAUSE_DURATIONS.map((d) => (
                <button
                  key={d}
                  onClick={() => pause(d)}
                  disabled={busy}
                  className={`btn-secondary px-3 text-xs ${d === 'indefinite' ? 'col-span-2' : ''}`}
                >
                  {PAUSE_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
