import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { ORDER_STATUS_TRANSITIONS, type OrderDTO, type OrderStatus } from '@store/shared';
import { customerName } from '../components/OrderCard';
import { Badge, Button, Section, StatusBadge } from '../components/ui';
import { useSocketEvent } from '../hooks/useSocketEvent';
import { api, ApiError } from '../lib/api';
import { formatDateTime, formatPrice, formatTime, shortId, STATUS_COLORS } from '../lib/format';
import { moveOrder } from '../lib/orders';
import type { RootScreenProps } from '../navigation/types';
import { useAuth } from '../store/auth';
import { colors, ui, useLayout } from '../theme';

export function OrderDetailScreen({ route, navigation }: RootScreenProps<'OrderDetail'>) {
  const { id } = route.params;
  const token = useAuth((s) => s.token);
  const { pad, wide } = useLayout();
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<OrderDTO>(`/orders/${id}`, { token })
      .then(setOrder)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load order'));
  }, [id, token]);
  useEffect(load, [load]);
  useSocketEvent('order:updated', (o) => o.id === id && setOrder(o));

  useEffect(() => {
    if (order) navigation.setOptions({ title: `Order ${shortId(order.id)}` });
  }, [order, navigation]);

  async function move(to: OrderStatus) {
    if (!order) return;
    setBusy(true);
    const updated = await moveOrder(order, to, token);
    if (updated) setOrder(updated);
    setBusy(false);
  }

  if (error) return <Text style={[ui.error, { padding: pad }]}>{error}</Text>;
  if (!order) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />;

  const next = ORDER_STATUS_TRANSITIONS[order.status].filter((s) => s !== 'Cancelled');
  const canCancel = ORDER_STATUS_TRANSITIONS[order.status].includes('Cancelled');
  const a = order.shippingAddress;
  const email = typeof order.customer === 'string' ? undefined : order.customer.email;

  const items = (
    <Section title="Items">
      {order.items.map((i) => (
        <View key={i.product} style={[ui.row, { justifyContent: 'space-between', gap: 12 }]}>
          <Text style={[ui.body, { flex: 1 }]}>
            <Text style={{ fontWeight: '800' }}>{i.quantity}×</Text> {i.title}
          </Text>
          <Text style={ui.body}>{formatPrice(i.price * i.quantity)}</Text>
        </View>
      ))}
      <View style={{ height: 1, backgroundColor: colors.border }} />
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <Text style={ui.h2}>Total</Text>
        <Text style={ui.h2}>{formatPrice(order.totalAmount)}</Text>
      </View>
      <View style={[ui.row, { gap: 8 }]}>
        <Text style={ui.muted}>Payment</Text>
        <Badge label={order.paymentStatus} tone={order.paymentStatus === 'Paid' ? 'emerald' : order.paymentStatus === 'Refunded' ? 'rose' : 'stone'} />
      </View>
    </Section>
  );

  const customer = (
    <Section title="Customer & delivery">
      <Text style={[ui.body, { fontWeight: '700' }]}>{customerName(order)}</Text>
      {email && <Text style={ui.muted}>{email}</Text>}
      <Text style={ui.body}>
        {a.line1}
        {a.line2 ? `, ${a.line2}` : ''}
        {'\n'}
        {a.city}, {a.state} {a.postalCode}
      </Text>
      {a.phone && (
        <Pressable onPress={() => Linking.openURL(`tel:${a.phone!.replace(/[^\d+]/g, '')}`)}>
          <Text style={{ color: colors.brandDark, fontWeight: '700' }}>📞 {a.phone}</Text>
        </Pressable>
      )}
    </Section>
  );

  const history = (
    <Section title="History">
      {order.statusHistory.map((e, i) => (
        <View key={i} style={[ui.row, { gap: 10, alignItems: 'flex-start' }]}>
          <View style={{ width: 10, height: 10, borderRadius: 5, marginTop: 5, backgroundColor: STATUS_COLORS[e.status].accent }} />
          <View style={{ flex: 1 }}>
            <Text style={[ui.body, { fontWeight: '600' }]}>{e.status}</Text>
            <Text style={ui.muted}>
              {formatTime(e.at)}
              {e.note ? ` · ${e.note}` : ''}
            </Text>
          </View>
        </View>
      ))}
    </Section>
  );

  return (
    <ScrollView style={ui.screen} contentContainerStyle={{ padding: pad, gap: 14 }}>
      <View style={[ui.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }]}>
        <View>
          <Text style={ui.h1}>{shortId(order.id)}</Text>
          <Text style={ui.muted}>Placed {formatDateTime(order.createdAt)}</Text>
        </View>
        <StatusBadge status={order.status} />
      </View>

      {(next.length > 0 || canCancel) && (
        <View style={[ui.row, { gap: 10, flexWrap: 'wrap' }]}>
          {next.map((s) => (
            <Button key={s} title={`Move to ${s}`} size="lg" style={{ flexGrow: 1 }} loading={busy} onPress={() => move(s)} />
          ))}
          {canCancel && (
            <Button title={order.paymentStatus === 'Paid' ? 'Cancel & refund' : 'Cancel'} size="lg" variant="danger" disabled={busy} onPress={() => move('Cancelled')} />
          )}
        </View>
      )}

      {wide ? (
        <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
          <View style={{ flex: 1.2, gap: 14 }}>{items}</View>
          <View style={{ flex: 1, gap: 14 }}>
            {customer}
            {history}
          </View>
        </View>
      ) : (
        <>
          {items}
          {customer}
          {history}
        </>
      )}
    </ScrollView>
  );
}
