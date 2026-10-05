import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import type { OrderDTO, Paginated } from '@store/shared';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { useSocketEvent } from '../hooks/useSocketEvent';
import { api } from '../lib/api';
import { formatDateTime, formatPrice, shortId } from '../lib/format';
import type { TabScreenProps } from '../navigation/types';
import { useAuth } from '../store/auth';
import { ui } from '../theme';

export function OrdersScreen({ navigation }: TabScreenProps<'Orders'>) {
  const token = useAuth((s) => s.token);
  const [orders, setOrders] = useState<OrderDTO[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await api<Paginated<OrderDTO>>('/orders/mine?limit=50', { token });
    setOrders(res.data);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  useSocketEvent('order:updated', (updated) =>
    setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o))),
  );

  if (!token) {
    return (
      <View style={[ui.screen, { alignItems: 'center', justifyContent: 'center', gap: 16 }]}>
        <Text style={ui.muted}>Sign in to see your orders.</Text>
        <Button title="Sign in" onPress={() => navigation.navigate('Login')} />
      </View>
    );
  }

  return (
    <FlatList
      style={ui.screen}
      data={orders}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load().catch(() => undefined);
        setRefreshing(false);
      }}
      ListEmptyComponent={<Text style={[ui.muted, { textAlign: 'center', marginTop: 40 }]}>No orders yet.</Text>}
      renderItem={({ item }) => (
        <Pressable
          style={[ui.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
          onPress={() => navigation.navigate('OrderTracking', { id: item.id })}
        >
          <View style={{ gap: 2 }}>
            <Text style={[ui.body, { fontWeight: '600' }]}>{shortId(item.id)}</Text>
            <Text style={ui.muted}>{formatDateTime(item.createdAt)}</Text>
            <Text style={ui.muted}>{formatPrice(item.totalAmount)}</Text>
          </View>
          <StatusBadge status={item.status} />
        </Pressable>
      )}
    />
  );
}
