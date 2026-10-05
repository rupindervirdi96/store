import { StyleSheet, Text, View } from 'react-native';
import { ORDER_PROGRESS, type OrderDTO } from '@store/shared';
import { formatDateTime } from '../lib/format';
import { colors, ui } from '../theme';

export function OrderTimeline({ order }: { order: OrderDTO }) {
  if (order.status === 'Cancelled') {
    return (
      <View style={[ui.card, { backgroundColor: '#fff1f2', borderColor: '#fecdd3' }]}>
        <Text style={{ color: '#9f1239' }}>This order was cancelled.</Text>
      </View>
    );
  }

  const reachedAt = new Map(order.statusHistory.map((e) => [e.status, e.at]));
  const currentIdx = ORDER_PROGRESS.indexOf(order.status);

  return (
    <View>
      {ORDER_PROGRESS.map((status, idx) => {
        const done = idx <= currentIdx;
        const last = idx === ORDER_PROGRESS.length - 1;
        const at = reachedAt.get(status);
        return (
          <View key={status} style={styles.row}>
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: done ? colors.brand : colors.border }]} />
              {!last && <View style={[styles.line, { backgroundColor: idx < currentIdx ? colors.brand : colors.border }]} />}
            </View>
            <View style={styles.label}>
              <Text style={[ui.body, { fontWeight: '600', color: done ? colors.text : colors.muted }]}>{status}</Text>
              {at && <Text style={ui.muted}>{formatDateTime(at)}</Text>}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', minHeight: 56 },
  rail: { width: 24, alignItems: 'center' },
  dot: { width: 14, height: 14, borderRadius: 7, marginTop: 3 },
  line: { flex: 1, width: 2, marginVertical: 2 },
  label: { flex: 1, paddingLeft: 10, paddingBottom: 16 },
});
