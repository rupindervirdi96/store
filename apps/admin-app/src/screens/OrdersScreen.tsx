import { useIsFocused } from '@react-navigation/native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, RefreshControl, ScrollView, Text, Vibration, View } from 'react-native';
import type { OrderDTO, OrderStatus, Paginated } from '@store/shared';
import { OrderCard } from '../components/OrderCard';
import { Chip, EmptyState } from '../components/ui';
import { useSocketEvent, useSocketStatus } from '../hooks/useSocketEvent';
import { api } from '../lib/api';
import { formatPrice, shortId, STATUS_COLORS } from '../lib/format';
import { moveOrder } from '../lib/orders';
import type { TabScreenProps } from '../navigation/types';
import { useAuth } from '../store/auth';
import { useSettings } from '../store/settings';
import { colors, ui, useLayout } from '../theme';

const ACTIVE: OrderStatus[] = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery'];
const DONE_LIMIT = 20;
const COLUMN_TITLES: Partial<Record<OrderStatus, string>> = { Pending: 'New', 'Out for Delivery': 'Out for delivery' };
const KEEP_AWAKE_TAG = 'orders-board';

function without(set: Set<string>, id: string) {
  const next = new Set(set);
  next.delete(id);
  return next;
}

export function OrdersScreen({ navigation }: TabScreenProps<'Orders'>) {
  const token = useAuth((s) => s.token);
  const { keepAwake, vibrateOnNewOrder } = useSettings();
  const { isTablet, width, pad } = useLayout();
  const focused = useIsFocused();

  const [orders, setOrders] = useState<Map<string, OrderDTO>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [flash, setFlash] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<OrderDTO | null>(null);
  const [tab, setTab] = useState<OrderStatus>('Pending');
  const [, tick] = useState(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const lists = await Promise.all([
      ...ACTIVE.map((s) => api<Paginated<OrderDTO>>(`/orders?status=${encodeURIComponent(s)}&limit=200`, { token })),
      api<Paginated<OrderDTO>>(`/orders?status=Delivered&limit=${DONE_LIMIT}`, { token }),
    ]);
    setOrders(new Map(lists.flatMap((l) => l.data).map((o) => [o.id, o])));
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load().catch(() => setLoading(false));
    const t = setInterval(() => tick((n) => n + 1), 30_000); // refresh "x min ago"
    return () => clearInterval(t);
  }, [load]);

  // Keep the tablet screen on while the board is visible.
  useEffect(() => {
    if (!keepAwake || !focused || Platform.OS === 'web') return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => void deactivateKeepAwake(KEEP_AWAKE_TAG);
  }, [keepAwake, focused]);

  const upsert = useCallback((o: OrderDTO) => setOrders((prev) => new Map(prev).set(o.id, o)), []);

  // ── Real-time feed ──────────────────────────────────────────
  useSocketEvent('order:created', (o) => {
    upsert(o);
    setFlash((s) => new Set(s).add(o.id));
    setTimeout(() => setFlash((s) => without(s, o.id)), 8000);
    setToast(o);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
    if (vibrateOnNewOrder && Platform.OS !== 'web') {
      Vibration.vibrate([0, 300, 150, 300]);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    }
  });
  useSocketEvent('order:updated', upsert);
  const live = useSocketStatus(() => void load());

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={[ui.row, { gap: 6, marginRight: pad }]}>
          <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: live ? colors.success : '#d6d3d1' }} />
          <Text style={ui.muted}>{live ? 'Live' : 'Connecting…'}</Text>
        </View>
      ),
    });
  }, [navigation, live, pad]);

  async function move(order: OrderDTO, to: OrderStatus) {
    setBusy((s) => new Set(s).add(order.id));
    const updated = await moveOrder(order, to, token);
    if (updated) upsert(updated);
    setBusy((s) => without(s, order.id));
  }

  const columns = useMemo(() => {
    const by = new Map<OrderStatus, OrderDTO[]>();
    for (const o of orders.values()) by.set(o.status, [...(by.get(o.status) ?? []), o]);
    // Oldest first while in progress (first in, first out); newest first when done.
    const sort = (s: OrderStatus, dir: 1 | -1) => (by.get(s) ?? []).sort((a, b) => dir * a.createdAt.localeCompare(b.createdAt));
    return [
      ...ACTIVE.map((s) => ({ status: s, orders: sort(s, 1) })),
      { status: 'Delivered' as OrderStatus, orders: sort('Delivered', -1).slice(0, DONE_LIMIT) },
    ];
  }, [orders]);

  const open = (o: OrderDTO) => navigation.navigate('OrderDetail', { id: o.id });
  const renderCard = (o: OrderDTO) => (
    <OrderCard key={o.id} order={o} highlight={flash.has(o.id)} busy={busy.has(o.id)} onMove={(to) => move(o, to)} onOpen={() => open(o)} />
  );
  const onRefresh = async () => {
    setRefreshing(true);
    await load().catch(() => undefined);
    setRefreshing(false);
  };

  if (loading) return <EmptyState title="Loading orders…" />;

  return (
    <View style={ui.screen}>
      {toast && (
        <Pressable
          onPress={() => { setToast(null); open(toast); }}
          style={{ position: 'absolute', zIndex: 10, bottom: 12, left: pad, right: pad, backgroundColor: colors.ink, borderRadius: 14, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 6 }}
        >
          <Text style={{ fontSize: 20 }}>🔔</Text>
          <Text style={{ color: '#fff', fontWeight: '700', flex: 1 }}>
            New order {shortId(toast.id)} · {formatPrice(toast.totalAmount)}
          </Text>
          <Text style={{ color: '#fdba74', fontWeight: '700' }}>Open →</Text>
        </Pressable>
      )}

      {isTablet ? (
        // Tablet: kanban columns side by side.
        <ScrollView horizontal contentContainerStyle={{ padding: pad, gap: 14 }}>
          {columns.map(({ status, orders: col }) => (
            <View
              key={status}
              style={{ width: Math.max(270, (width - pad * 2 - 14 * 3) / 4), backgroundColor: '#ebe9e6', borderRadius: 16, borderTopWidth: 4, borderTopColor: STATUS_COLORS[status].accent }}
            >
              <View style={[ui.row, { justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12 }]}>
                <Text style={ui.h3}>{COLUMN_TITLES[status] ?? status}</Text>
                <View style={{ backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2 }}>
                  <Text style={{ fontWeight: '700', color: '#57534e' }}>{col.length}</Text>
                </View>
              </View>
              <ScrollView
                contentContainerStyle={{ padding: 10, paddingTop: 0, gap: 10 }}
                refreshControl={status === 'Pending' ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} /> : undefined}
              >
                {col.length === 0 ? <Text style={[ui.muted, { textAlign: 'center', paddingVertical: 20 }]}>No orders</Text> : col.map(renderCard)}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      ) : (
        // Phone: one status at a time.
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ padding: pad, gap: 8 }}>
            {columns.map((c) => (
              <Chip key={c.status} label={COLUMN_TITLES[c.status] ?? c.status} count={c.orders.length} active={tab === c.status} onPress={() => setTab(c.status)} />
            ))}
          </ScrollView>
          <FlatList
            data={columns.find((c) => c.status === tab)?.orders ?? []}
            keyExtractor={(o) => o.id}
            contentContainerStyle={{ paddingHorizontal: pad, paddingBottom: pad, gap: 10 }}
            renderItem={({ item }) => renderCard(item)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={<EmptyState title="No orders here" body="New paid orders appear instantly." />}
          />
        </>
      )}
    </View>
  );
}
