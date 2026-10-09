import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatClosureDate, groupWeeklyHours, type StoreInfoDTO } from '@store/shared';
import { colors, ui } from '../theme';

const TONES = {
  open: { bg: '#ecfdf5', border: '#a7f3d0', dot: colors.success, text: '#065f46' },
  hours: { bg: '#f8fafc', border: colors.border, dot: colors.muted, text: colors.text },
  closure: { bg: '#fff1f2', border: '#fecdd3', dot: colors.danger, text: '#9f1239' },
  paused: { bg: '#fffbeb', border: '#fde68a', dot: '#d97706', text: '#92400e' },
};

/** "● Open now · Closes at 10:00 pm". Tap to see the weekly hours. */
export function StoreStatusBanner({ info }: { info: StoreInfoDTO | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!info) return null;
  const { status } = info;
  const tone = TONES[status.reason];

  return (
    <Pressable
      onPress={() => setExpanded((e) => !e)}
      accessibilityRole="button"
      accessibilityHint={expanded ? 'Hides opening hours' : 'Shows opening hours'}
      style={[styles.banner, { backgroundColor: tone.bg, borderColor: tone.border }]}
    >
      <View style={[styles.row, { gap: 8 }]}>
        <View style={[styles.dot, { backgroundColor: tone.dot }]} />
        <Text style={{ flex: 1, color: tone.text }}>
          <Text style={{ fontWeight: '700' }}>{status.headline}</Text> · {status.detail}
        </Text>
        <Text style={[ui.muted, { color: tone.text }]}>{expanded ? 'Hide' : 'Hours'}</Text>
      </View>

      {!status.isOpen && !expanded && (
        <Text style={[ui.muted, { marginTop: 4, color: tone.text }]}>
          You can browse and fill your cart; checkout opens when we do.
        </Text>
      )}

      {expanded && (
        <View style={{ marginTop: 10, gap: 4 }}>
          {groupWeeklyHours(info.hours.weekly).map((h) => (
            <View key={h.days} style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text style={ui.body}>{h.days}</Text>
              <Text style={ui.muted}>{h.time}</Text>
            </View>
          ))}
          {info.upcomingClosures.slice(0, 3).map((c) => (
            <Text key={c.date} style={[ui.muted, { color: colors.danger }]}>
              Closed {formatClosureDate(c.date)}
              {c.note ? ` · ${c.note}` : ''}
            </Text>
          ))}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1, borderRadius: 12, padding: 12 },
  row: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
