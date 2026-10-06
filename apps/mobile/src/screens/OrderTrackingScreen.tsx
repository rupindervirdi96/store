import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { OrderDTO } from '@store/shared';
import { Button } from '../components/Button';
import { OrderTimeline } from '../components/OrderTimeline';
import { StatusBadge } from '../components/StatusBadge';
import { useSocketEvent, useSocketStatus } from '../hooks/useSocketEvent';
import { api, ApiError } from '../lib/api';
import { formatDateTime, formatPrice, shortId } from '../lib/format';
import type { RootScreenProps } from '../navigation/types';
import { useAuth } from '../store/auth';
import { useCart } from '../store/cart';
import { colors, ui } from '../theme';

export function OrderTrackingScreen({ route }: RootScreenProps<'OrderTracking'>) {
  const { id } = route.params;
  const token = useAuth((s) => s.token);
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(() => {
    api<OrderDTO>(`/orders/${id}`, { token })
      .then(setOrder)
      .catch((e: Error) => setError(e.message));
  }, [id, token]);

  useEffect(load, [load]);

  const clearCart = useCart((s) => s.clear);
  // Real-time: status pushes arrive on this user's private socket room.
  useSocketEvent('order:updated', (updated) => {
    if (updated.id !== id) return;
    // Payment confirmed while watching: the cart has been bought.
    if (order?.status === 'Awaiting Payment' && updated.paymentStatus === 'Paid') clearCart();
    setOrder(updated);
  });
  const live = useSocketStatus(load);

  const [paying, setPaying] = useState(false);
  async function payNow() {
    setPaying(true);
    try {
      const { checkoutUrl } = await api<{ checkoutUrl: string }>(`/orders/${id}/checkout`, { token });
      await WebBrowser.openBrowserAsync(checkoutUrl, { dismissButtonStyle: 'done' });
    } catch (e) {
      Alert.alert('Payment', e instanceof ApiError ? e.message : 'Could not open the payment page');
    } finally {
      setPaying(false);
      load();
    }
  }

  const cancel = () =>
    Alert.alert('Cancel order?', order?.paymentStatus === 'Paid' ? 'You will get a full refund to your card.' : 'This cannot be undone.', [
      { text: 'Keep order', style: 'cancel' },
      {
        text: 'Cancel order',
        style: 'destructive',
        onPress: async () => {
          setCancelling(true);
          try {
            setOrder(await api<OrderDTO>(`/orders/${id}/cancel`, { method: 'POST', token }));
          } catch (e) {
            Alert.alert('Error', e instanceof ApiError ? e.message : 'Could not cancel');
          } finally {
            setCancelling(false);
          }
        },
      },
    ]);

  if (error) return <Text style={[ui.error, { padding: 16 }]}>{error}</Text>;
  if (!order) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />;

  return (
    <ScrollView style={ui.screen} contentContainerStyle={{ padding: 16, gap: 16 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <View>
          <Text style={ui.h1}>{shortId(order.id)}</Text>
          <Text style={ui.muted}>Placed {formatDateTime(order.createdAt)}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <StatusBadge status={order.status} />
          <Text style={[ui.muted, { fontSize: 11 }]}>{live ? '● Live' : '○ Reconnecting…'}</Text>
        </View>
      </View>

      {order.status === 'Awaiting Payment' ? (
        <View style={[ui.card, { gap: 12 }]}>
          <Text style={ui.h2}>Waiting for payment</Text>
          <Text style={ui.muted}>
            Your items are reserved
            {order.paymentExpiresAt
              ? ` until ${new Date(order.paymentExpiresAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
              : ''}
            . The kitchen starts once payment is complete.
          </Text>
          <Button title={`Pay ${formatPrice(order.totalAmount)}`} onPress={payNow} loading={paying} />
        </View>
      ) : (
        <View style={ui.card}>
          <OrderTimeline order={order} />
        </View>
      )}

      <View style={[ui.card, { gap: 6 }]}>
        {order.items.map((i) => (
          <View key={i.product} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text style={ui.body}>
              {i.quantity} × {i.title}
            </Text>
            <Text style={ui.body}>{formatPrice(i.price * i.quantity)}</Text>
          </View>
        ))}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
          <Text style={ui.h2}>Total</Text>
          <Text style={ui.h2}>{formatPrice(order.totalAmount)}</Text>
        </View>
      </View>

      {(order.status === 'Pending' || order.status === 'Awaiting Payment') && (
        <Button
          title={order.paymentStatus === 'Paid' ? 'Cancel & refund' : 'Cancel order'}
          variant="danger"
          onPress={cancel}
          loading={cancelling}
        />
      )}
    </ScrollView>
  );
}
