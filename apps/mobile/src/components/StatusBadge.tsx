import { Text, View } from 'react-native';
import type { OrderStatus } from '@store/shared';
import { STATUS_COLORS } from '../lib/format';

export function StatusBadge({ status }: { status: OrderStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <View style={{ backgroundColor: c.bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}>
      <Text style={{ color: c.fg, fontSize: 12, fontWeight: '600' }}>{status}</Text>
    </View>
  );
}
