import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import {
  DATE_PATTERN,
  TIMEZONES,
  TIME_PATTERN,
  WEEKDAYS,
  WEEKDAY_NAMES,
  formatClosureDate,
  formatTime,
  type Closure,
  type DayHours,
  type StoreInfoDTO,
  type Weekday,
} from '@store/shared';
import { StoreStatusCard, useAdminStoreInfo } from '../components/StoreStatusCard';
import { Button, Chip, Field, Section } from '../components/ui';
import { api, ApiError } from '../lib/api';
import { notify } from '../lib/dialog';
import { useAuth } from '../store/auth';
import { colors, ui, useLayout } from '../theme';

type Draft = { timezone: string; weekly: Record<Weekday, DayHours>; closures: Closure[] };

const toDraft = (i: StoreInfoDTO): Draft => ({ timezone: i.hours.timezone, weekly: i.hours.weekly, closures: i.hours.closures });

/** Typing "1130" gives "11:30". */
function maskTime(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d;
}

/** Typing "20261225" gives "2026-12-25". */
function maskDate(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return [d.slice(0, 4), d.slice(4, 6), d.slice(6)].filter(Boolean).join('-');
}

function TimeInput({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const valid = TIME_PATTERN.test(value);
  return (
    <View style={{ alignItems: 'center' }}>
      <TextInput
        value={value}
        onChangeText={(v) => onChange(maskTime(v))}
        keyboardType="number-pad"
        maxLength={5}
        placeholder="HH:MM"
        accessibilityLabel={label}
        style={[ui.input, { width: 90, textAlign: 'center', paddingVertical: 8 }, !valid && { borderColor: colors.danger }]}
      />
      <Text style={[ui.muted, { fontSize: 11, marginTop: 2 }]}>{valid ? formatTime(value) : '24-hour'}</Text>
    </View>
  );
}

export function HoursScreen() {
  const token = useAuth((s) => s.token);
  const { pad } = useLayout();
  const [info, setInfo] = useAdminStoreInfo();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [closure, setClosure] = useState<Closure>({ date: '', note: '' });

  // Start editing from the first load only, so the minute refresh doesn't wipe edits.
  useEffect(() => {
    if (info && !draft) setDraft(toDraft(info));
  }, [info, draft]);

  if (!info || !draft) return <View style={ui.screen} />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(toDraft(info));
  const dayError = (d: DayHours) =>
    d.closed ? null : !TIME_PATTERN.test(d.open) || !TIME_PATTERN.test(d.close) ? 'Use HH:MM, e.g. 11:00' : d.open === d.close ? 'Opening and closing times must differ' : null;
  const invalid = WEEKDAYS.some((d) => dayError(draft.weekly[d]));
  const setDay = (day: Weekday, patch: Partial<DayHours>) =>
    setDraft({ ...draft, weekly: { ...draft.weekly, [day]: { ...draft.weekly[day], ...patch } } });

  async function save() {
    setSaving(true);
    try {
      const next = await api<StoreInfoDTO>('/store/hours', { method: 'PUT', body: draft, token });
      setInfo(next);
      setDraft(toDraft(next));
      notify('Hours saved', 'The website and app now show the new hours.');
    } catch (e) {
      notify('Could not save', e instanceof ApiError ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function addClosure() {
    if (!DATE_PATTERN.test(closure.date)) return;
    const note = closure.note?.trim();
    setDraft({
      ...draft!,
      closures: [...draft!.closures.filter((c) => c.date !== closure.date), { date: closure.date, ...(note && { note }) }].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    });
    setClosure({ date: '', note: '' });
  }

  return (
    <ScrollView
      style={ui.screen}
      contentContainerStyle={{ padding: pad, gap: 14, maxWidth: 820, width: '100%', alignSelf: 'center' }}
      keyboardShouldPersistTaps="handled"
    >
      <StoreStatusCard info={info} onChange={setInfo} />

      <Section title="Weekly hours" subtitle="Online orders are only accepted during these hours. A closing time before the opening time runs past midnight.">
        {WEEKDAYS.map((day) => {
          const d = draft.weekly[day];
          const err = dayError(d);
          return (
            <View key={day} style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 4 }}>
              <View style={[ui.row, { gap: 12, flexWrap: 'wrap' }]}>
                <Text style={[ui.body, { fontWeight: '700', width: 100 }]}>{WEEKDAY_NAMES[day]}</Text>
                <Switch
                  value={!d.closed}
                  onValueChange={(open) => setDay(day, { closed: !open })}
                  trackColor={{ true: colors.success, false: '#d6d3d1' }}
                  accessibilityLabel={`${WEEKDAY_NAMES[day]} open`}
                />
                {d.closed ? (
                  <Text style={ui.muted}>Closed</Text>
                ) : (
                  <View style={[ui.row, { gap: 8 }]}>
                    <TimeInput value={d.open} onChange={(v) => setDay(day, { open: v })} label={`${WEEKDAY_NAMES[day]} opens`} />
                    <Text style={[ui.muted, { marginBottom: 14 }]}>to</Text>
                    <TimeInput value={d.close} onChange={(v) => setDay(day, { close: v })} label={`${WEEKDAY_NAMES[day]} closes`} />
                  </View>
                )}
                <Pressable
                  onPress={() =>
                    setDraft({ ...draft, weekly: Object.fromEntries(WEEKDAYS.map((w) => [w, { ...d }])) as Draft['weekly'] })
                  }
                  style={{ marginLeft: 'auto' }}
                  hitSlop={8}
                >
                  <Text style={{ color: colors.brandDark, fontWeight: '600', fontSize: 13 }}>Copy to all</Text>
                </Pressable>
              </View>
              {err && <Text style={[ui.muted, { color: colors.danger }]}>{err}</Text>}
            </View>
          );
        })}
      </Section>

      <Section title="Holidays and special closures" subtitle="Closed all day on these dates.">
        {draft.closures.length === 0 && <Text style={ui.muted}>No closures planned.</Text>}
        {draft.closures.map((c) => (
          <View key={c.date} style={[ui.row, { gap: 12 }]}>
            <Text style={[ui.body, { fontWeight: '600', width: 110 }]}>{formatClosureDate(c.date)}</Text>
            <Text style={[ui.muted, { flex: 1 }]}>{c.note}</Text>
            <Button
              title="Remove"
              variant="danger"
              size="sm"
              onPress={() => setDraft({ ...draft, closures: draft.closures.filter((x) => x.date !== c.date) })}
            />
          </View>
        ))}
        <View style={[ui.row, { gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }]}>
          <View style={{ width: 150 }}>
            <Field label="Date" hint="YYYY-MM-DD">
              <TextInput
                value={closure.date}
                onChangeText={(v) => setClosure({ ...closure, date: maskDate(v) })}
                keyboardType="number-pad"
                placeholder="2026-12-25"
                style={ui.input}
              />
            </Field>
          </View>
          <View style={{ flex: 1, minWidth: 180 }}>
            <Field label="Note (optional)" hint=" ">
              <TextInput
                value={closure.note}
                onChangeText={(v) => setClosure({ ...closure, note: v })}
                placeholder="Christmas Day"
                maxLength={80}
                style={ui.input}
              />
            </Field>
          </View>
          <Button title="Add" variant="secondary" onPress={addClosure} disabled={!DATE_PATTERN.test(closure.date)} style={{ marginBottom: 32 }} />
        </View>
      </Section>

      <Section title="Time zone">
        <View style={[ui.row, { flexWrap: 'wrap', gap: 8 }]}>
          {TIMEZONES.map((t) => (
            <Chip key={t.id} label={t.label} active={draft.timezone === t.id} onPress={() => setDraft({ ...draft, timezone: t.id })} />
          ))}
        </View>
      </Section>

      <View style={[ui.row, { gap: 10, marginBottom: 24 }]}>
        <Button title="Save hours" onPress={save} loading={saving} disabled={!dirty || invalid} size="lg" style={{ flex: 1 }} />
        {dirty && <Button title="Discard" variant="secondary" size="lg" onPress={() => setDraft(toDraft(info))} />}
      </View>
    </ScrollView>
  );
}
