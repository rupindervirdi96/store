import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ORDER_STATUS_TRANSITIONS, type OrderDTO, type OrderStatus } from '@store/shared';
import { formatPrice, minutesAgo, shortId, STATUS_COLORS } from '../lib/format';
import { colors, ui } from '../theme';
import { Badge, Button } from './ui';

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  Confirmed: 'Confirm',
  Preparing: 'Start preparing',
  'Out for Delivery': 'Out for delivery',
  Delivered: 'Delivered',
};

export function customerName(o: OrderDTO) {
  return typeof o.customer === 'string' ? 'Customer' : o.customer.name;
}

export function OrderCard({
  order,
  highlight,
  busy,
  onMove,
  onOpen,
}: {
  order: OrderDTO;
  highlight?: boolean;
  busy?: boolean;
  onMove: (to: OrderStatus) => void;
  onOpen: () => void;
}) {
  const next = ORDER_STATUS_TRANSITIONS[order.status].filter((s) => s !== 'Cancelled');
  const canCancel = ORDER_STATUS_TRANSITIONS[order.status].includes('Cancelled');
  const shown = order.items.slice(0, 4);
  const more = order.items.length - shown.length;

  return (
    <Pressable
      onPress={onOpen}
      style={[styles.card, { borderLeftColor: STATUS_COLORS[order.status].accent }, highlight && styles.highlight, busy && { opacity: 0.55 }]}
    >
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>{shortId(order.id)}</Text>
        <Text style={ui.muted}>{minutesAgo(order.createdAt)}</Text>
      </View>
      <Text style={[ui.body, { fontWeight: '600' }]} numberOfLines={1}>
        {customerName(order)}
      </Text>
      <View style={{ gap: 2 }}>
        {shown.map((i) => (
          <Text key={i.product} style={{ fontSize: 14, color: '#44403c' }} numberOfLines={1}>
            <Text style={{ fontWeight: '800' }}>{i.quantity}×</Text> {i.title}
          </Text>
        ))}
        {more > 0 && <Text style={ui.muted}>+{more} more</Text>}
      </View>
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{formatPrice(order.totalAmount)}</Text>
        <Badge label={order.paymentStatus} tone={order.paymentStatus === 'Paid' ? 'emerald' : order.paymentStatus === 'Refunded' ? 'rose' : 'stone'} />
      </View>
      {(next.length > 0 || canCancel) && (
        <View style={[ui.row, { gap: 8, marginTop: 2 }]}>
          {next.map((s) => (
            <Button key={s} title={NEXT_LABEL[s] ?? s} size="sm" style={{ flex: 1 }} disabled={busy} onPress={() => onMove(s)} />
          ))}
          {canCancel && <Button title="Cancel" size="sm" variant="danger" disabled={busy} onPress={() => onMove('Cancelled')} />}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    gap: 8,
    borderLeftWidth: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  highlight: { borderColor: colors.brand, borderWidth: 2, backgroundColor: colors.brandSoft },
});
