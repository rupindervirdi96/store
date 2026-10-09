import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';
import { PAUSE_DURATIONS, PAUSE_LABELS, type PauseDuration, type StoreInfoDTO } from '@store/shared';
import { api, ApiError } from '../lib/api';
import { confirm, notify } from '../lib/dialog';
import { useAuth } from '../store/auth';
import { colors, ui } from '../theme';
import { Button, Section } from './ui';

/** Store info for the admin screens, refreshed on focus and every minute. */
export function useAdminStoreInfo() {
  const [info, setInfo] = useState<StoreInfoDTO | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const load = () =>
        api<StoreInfoDTO>('/store')
          .then((i) => alive && setInfo(i))
          .catch(() => undefined);
      void load();
      const id = setInterval(load, 60_000);
      return () => {
        alive = false;
        clearInterval(id);
      };
    }, []),
  );
  return [info, setInfo] as const;
}

/** Live open/closed state with one-tap pause and resume for online orders. */
export function StoreStatusCard({
  info,
  onChange,
  right,
}: {
  info: StoreInfoDTO | null;
  onChange: (next: StoreInfoDTO) => void;
  right?: ReactNode;
}) {
  const token = useAuth((s) => s.token);
  const [busy, setBusy] = useState(false);

  async function run(path: string, method: 'POST' | 'DELETE', body?: unknown) {
    setBusy(true);
    try {
      onChange(await api<StoreInfoDTO>(path, { method, body, token }));
    } catch (e) {
      notify('Could not update the store', e instanceof ApiError ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function pause(duration: PauseDuration) {
    if (duration === 'indefinite') {
      const ok = await confirm(
        'Pause until you resume?',
        'Customers won’t be able to order online until someone taps “Resume orders”.',
        'Pause orders',
      );
      if (!ok) return;
    }
    await run('/store/pause', 'POST', { duration });
  }

  if (!info) return <Section title="Store status" subtitle="Loading…" />;
  const { status, hours } = info;
  const color = status.isOpen ? colors.success : status.reason === 'paused' ? colors.warning : colors.muted;

  return (
    <Section title="Store status" right={right}>
      <View style={[ui.row, { gap: 10 }]}>
        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
        <View style={{ flex: 1 }}>
          <Text style={[ui.h2, { color: status.isOpen ? '#047857' : colors.text }]}>{status.headline}</Text>
          <Text style={ui.muted}>{status.detail}</Text>
        </View>
      </View>

      {hours.paused ? (
        <Button title="Resume orders now" onPress={() => run('/store/pause', 'DELETE')} loading={busy} size="lg" />
      ) : (
        <View style={{ gap: 8 }}>
          <Text style={ui.muted}>Kitchen swamped or closing early? Pause online orders for:</Text>
          <View style={[ui.row, { flexWrap: 'wrap', gap: 8 }]}>
            {PAUSE_DURATIONS.map((d) => (
              <Button key={d} title={PAUSE_LABELS[d]} variant="secondary" size="sm" disabled={busy} onPress={() => pause(d)} />
            ))}
          </View>
        </View>
      )}
    </Section>
  );
}
