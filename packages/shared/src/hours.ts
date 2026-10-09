/**
 * Opening hours: the weekly schedule, one-off closures and a manual pause,
 * plus the "are we open?" calculation in the store's own time zone.
 *
 * getStoreStatus uses Intl time zones and runs on the API; clients display
 * the status the API returns, so a phone in another time zone still shows
 * the store's local times.
 */

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_NAMES: Record<Weekday, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
};

export interface DayHours {
  closed: boolean;
  /** "HH:mm", 24-hour. */
  open: string;
  /** "HH:mm", 24-hour. At or before `open` means after midnight (e.g. 18:00–02:00). */
  close: string;
}

export interface Closure {
  /** Store-local date, "YYYY-MM-DD". */
  date: string;
  note?: string;
}

export interface StoreHoursDTO {
  /** IANA time zone, e.g. "America/Toronto". */
  timezone: string;
  weekly: Record<Weekday, DayHours>;
  closures: Closure[];
  /** Ordering paused by staff (busy kitchen, closed early…). */
  paused: boolean;
  /** When a pause ends by itself; null with `paused` means until someone resumes. */
  pausedUntil: string | null;
}

export interface StoreStatusDTO {
  isOpen: boolean;
  reason: 'open' | 'hours' | 'closure' | 'paused';
  /** "Open now", "Closed", "Closed today", "Ordering paused". */
  headline: string;
  /** "Closes at 10:00 pm", "Opens tomorrow at 11:00 am", "Christmas Day". */
  detail: string;
  opensAt: string | null;
  closesAt: string | null;
}

/** GET /store */
export interface StoreInfoDTO {
  hours: StoreHoursDTO;
  status: StoreStatusDTO;
  /** Closures from today onwards (store-local), soonest first. */
  upcomingClosures: Closure[];
}

/** POST /store/pause */
export const PAUSE_DURATIONS = ['30m', '1h', '2h', 'rest-of-day', 'indefinite'] as const;
export type PauseDuration = (typeof PAUSE_DURATIONS)[number];

export const PAUSE_LABELS: Record<PauseDuration, string> = {
  '30m': '30 minutes',
  '1h': '1 hour',
  '2h': '2 hours',
  'rest-of-day': 'Rest of today',
  indefinite: 'Until I resume',
};

export const TIMEZONES: readonly { id: string; label: string }[] = [
  { id: 'America/St_Johns', label: 'Newfoundland (St. John’s)' },
  { id: 'America/Halifax', label: 'Atlantic (Halifax)' },
  { id: 'America/Toronto', label: 'Eastern (Toronto, Ottawa, Montréal)' },
  { id: 'America/Winnipeg', label: 'Central (Winnipeg)' },
  { id: 'America/Regina', label: 'Saskatchewan (Regina)' },
  { id: 'America/Edmonton', label: 'Mountain (Edmonton, Calgary)' },
  { id: 'America/Vancouver', label: 'Pacific (Vancouver)' },
  { id: 'America/Whitehorse', label: 'Yukon (Whitehorse)' },
  { id: 'America/New_York', label: 'US Eastern (New York)' },
  { id: 'America/Chicago', label: 'US Central (Chicago)' },
  { id: 'America/Denver', label: 'US Mountain (Denver)' },
  { id: 'America/Phoenix', label: 'US Arizona (Phoenix)' },
  { id: 'America/Los_Angeles', label: 'US Pacific (Los Angeles)' },
];

export const DEFAULT_STORE_HOURS: StoreHoursDTO = {
  timezone: 'America/Toronto',
  weekly: {
    mon: { closed: false, open: '11:00', close: '22:00' },
    tue: { closed: false, open: '11:00', close: '22:00' },
    wed: { closed: false, open: '11:00', close: '22:00' },
    thu: { closed: false, open: '11:00', close: '22:00' },
    fri: { closed: false, open: '11:00', close: '23:00' },
    sat: { closed: false, open: '11:00', close: '23:00' },
    sun: { closed: false, open: '12:00', close: '21:00' },
  },
  closures: [],
  paused: false,
  pausedUntil: null,
};

export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
export const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

// ── Formatting (pure; safe on every client) ────────────────────────────────

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

/** "23:00" → "11:00 pm", "00:00" → "12:00 am". */
export function formatTime(hhmm: string): string {
  const mins = toMinutes(hhmm);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}

/** "11:00 am – 10:00 pm", or "Closed". */
export function formatDayHours(day: DayHours): string {
  return day.closed ? 'Closed' : `${formatTime(day.open)} – ${formatTime(day.close)}`;
}

/** Merges consecutive days with the same hours: [{ days: "Monday – Thursday", time: "11:00 am – 10:00 pm" }, …]. */
export function groupWeeklyHours(weekly: Record<Weekday, DayHours>): { days: string; time: string }[] {
  const groups: { from: Weekday; to: Weekday; time: string }[] = [];
  for (const day of WEEKDAYS) {
    const time = formatDayHours(weekly[day]);
    const last = groups[groups.length - 1];
    if (last && last.time === time) last.to = day;
    else groups.push({ from: day, to: day, time });
  }
  return groups.map((g) => ({
    days: g.from === g.to ? WEEKDAY_NAMES[g.from] : `${WEEKDAY_NAMES[g.from]} – ${WEEKDAY_NAMES[g.to]}`,
    time: g.time,
  }));
}

/** "2026-12-25" → "Fri, Dec 25". */
export function formatClosureDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getUTCDay()];
  const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1];
  return `${wd}, ${mon} ${d}`;
}

// ── Time zone maths (Intl; used by the API) ────────────────────────────────

interface ZonedParts {
  date: string;
  minutes: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();

function zoned(instant: Date, timezone: string): ZonedParts & { seconds: number } {
  let f = formatters.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    formatters.set(timezone, f);
  }
  const p = Object.fromEntries(f.formatToParts(instant).map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: (Number(p.hour) % 24) * 60 + Number(p.minute),
    seconds: Number(p.second),
  };
}

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function weekdayOf(date: string): Weekday {
  const [y, m, d] = date.split('-').map(Number);
  return WEEKDAYS[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7];
}

/** The instant when the store's wall clock shows `date` + `minutes` (minutes may exceed 1440). */
function instantAt(date: string, minutes: number, timezone: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, minutes);
  const offsetAt = (t: number) => {
    const z = zoned(new Date(t), timezone);
    const [zy, zm, zd] = z.date.split('-').map(Number);
    return Date.UTC(zy, zm - 1, zd, 0, z.minutes, z.seconds) - Math.floor(t / 1000) * 1000;
  };
  // Two passes settle the offset across DST changes.
  let t = wall - offsetAt(wall);
  t = wall - offsetAt(t);
  return new Date(t);
}

interface Period {
  date: string;
  start: Date;
  end: Date;
}

function periodOn(h: StoreHoursDTO, date: string): Period | null {
  const day = h.weekly[weekdayOf(date)];
  if (day.closed || h.closures.some((c) => c.date === date)) return null;
  const open = toMinutes(day.open);
  let close = toMinutes(day.close);
  if (close <= open) close += 24 * 60;
  return { date, start: instantAt(date, open, h.timezone), end: instantAt(date, close, h.timezone) };
}

/** Today's date in the store's time zone. */
export function storeToday(h: Pick<StoreHoursDTO, 'timezone'>, now = new Date()): string {
  return zoned(now, h.timezone).date;
}

/** When a pause of `duration` started `now` should end (null = until resumed). */
export function pauseEndsAt(h: StoreHoursDTO, duration: PauseDuration, now = new Date()): Date | null {
  const minutes = { '30m': 30, '1h': 60, '2h': 120 } as Record<string, number>;
  if (duration in minutes) return new Date(now.getTime() + minutes[duration] * 60_000);
  if (duration === 'indefinite') return null;
  // Rest of today: the end of the current opening, or else local midnight.
  const today = storeToday(h, now);
  const current = [addDays(today, -1), today]
    .map((d) => periodOn(h, d))
    .find((p) => p && p.start <= now && now < p.end);
  return current ? current.end : instantAt(today, 24 * 60, h.timezone);
}

export function getStoreStatus(h: StoreHoursDTO, now = new Date()): StoreStatusDTO {
  const today = storeToday(h, now);
  const periods = Array.from({ length: 10 }, (_, i) => periodOn(h, addDays(today, i - 1))).filter(
    (p): p is Period => p !== null,
  );

  const pauseEnd = h.paused ? (h.pausedUntil ? new Date(h.pausedUntil) : null) : undefined;
  const pausedNow = h.paused && (pauseEnd === null || (pauseEnd !== undefined && pauseEnd > now));
  const current = periods.find((p) => p.start <= now && now < p.end);

  if (current && !pausedNow) {
    return {
      isOpen: true,
      reason: 'open',
      headline: 'Open now',
      detail: `Closes at ${clock(current.end, h.timezone)}`,
      opensAt: null,
      closesAt: current.end.toISOString(),
    };
  }

  // Next time orders are accepted: the first opening that is still running
  // once any pause has ended.
  const from = pausedNow ? pauseEnd : now;
  const next = from ? periods.find((p) => p.end > from) : undefined;
  const opensAt = next && from ? new Date(Math.max(next.start.getTime(), from.getTime())) : null;
  const at = opensAt && `${relativeDay(opensAt, today, h.timezone)} at ${clock(opensAt, h.timezone)}`;
  const when = at ? `Opens ${at}` : null;

  if (pausedNow) {
    return {
      isOpen: false,
      reason: 'paused',
      headline: 'Ordering paused',
      detail: pauseEnd === null ? 'Online ordering is paused for now' : at ? `Back ${at}` : 'Back soon',
      opensAt: opensAt?.toISOString() ?? null,
      closesAt: null,
    };
  }

  const closure = h.closures.find((c) => c.date === today);
  if (closure) {
    return {
      isOpen: false,
      reason: 'closure',
      headline: 'Closed today',
      detail: [closure.note, when].filter(Boolean).join(' · ') || 'Back soon',
      opensAt: opensAt?.toISOString() ?? null,
      closesAt: null,
    };
  }

  return {
    isOpen: false,
    reason: 'hours',
    headline: 'Closed',
    detail: when ?? 'Check back soon',
    opensAt: opensAt?.toISOString() ?? null,
    closesAt: null,
  };
}

function clock(instant: Date, timezone: string): string {
  const { minutes } = zoned(instant, timezone);
  return formatTime(`${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`);
}

function relativeDay(instant: Date, today: string, timezone: string): string {
  const date = zoned(instant, timezone).date;
  if (date === today) return 'today';
  if (date === addDays(today, 1)) return 'tomorrow';
  for (let i = 2; i < 7; i++) if (date === addDays(today, i)) return WEEKDAY_NAMES[weekdayOf(date)];
  return formatClosureDate(date);
}
