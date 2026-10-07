import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Image, Pressable, RefreshControl, ScrollView, SectionList, Switch, Text, TextInput, View } from 'react-native';
import type { CategoryDTO, Paginated, ProductDTO } from '@store/shared';
import { Badge, Button, Chip, EmptyState, Stepper } from '../components/ui';
import { useSocketEvent } from '../hooks/useSocketEvent';
import { api, ApiError, refreshStorefront } from '../lib/api';
import { notify } from '../lib/dialog';
import { formatPrice } from '../lib/format';
import type { TabScreenProps } from '../navigation/types';
import { useAuth } from '../store/auth';
import { colors, ui, useLayout } from '../theme';

const LOW_STOCK = 5;
type Filter = 'all' | 'visible' | 'hidden' | 'offer' | 'low';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'visible', label: 'On menu' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'offer', label: 'On offer' },
  { value: 'low', label: 'Low stock' },
];
const matches = (p: ProductDTO, f: Filter) =>
  f === 'all' ||
  (f === 'visible' && p.isActive) ||
  (f === 'hidden' && !p.isActive) ||
  (f === 'offer' && p.compareAtPrice != null) ||
  (f === 'low' && p.stockQuantity <= LOW_STOCK);

export function MenuScreen({ navigation }: TabScreenProps<'Menu'>) {
  const token = useAuth((s) => s.token);
  const { pad, isTablet } = useLayout();
  const [products, setProducts] = useState<ProductDTO[] | null>(null);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      api<Paginated<ProductDTO>>('/products?includeInactive=true&limit=100', { token }),
      api<CategoryDTO[]>('/categories?includeInactive=true', { token }),
    ]);
    setProducts(p.data);
    setCategories(c);
  }, [token]);

  // Reload whenever the tab comes back into view (e.g. after editing an item).
  useFocusEffect(
    useCallback(() => {
      load().catch(() => undefined);
    }, [load]),
  );

  useSocketEvent('product:stock', ({ id, stockQuantity }) =>
    setProducts((list) => list?.map((p) => (p.id === id ? { ...p, stockQuantity } : p)) ?? list),
  );

  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Button title="+ Add item" size="sm" style={{ marginRight: pad }} onPress={() => navigation.navigate('EditItem', {})} />
      ),
    });
  }, [navigation, pad]);

  async function mutate(p: ProductDTO, path: string, body: unknown) {
    setBusy((s) => new Set(s).add(p.id));
    try {
      const updated = await api<ProductDTO>(path, { method: 'PATCH', body, token });
      setProducts((list) => list?.map((x) => (x.id === updated.id ? updated : x)) ?? list);
      refreshStorefront(token);
    } catch (e) {
      notify('Could not update', e instanceof ApiError ? e.message : undefined);
    } finally {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(p.id);
        return next;
      });
    }
  }

  const sections = useMemo(() => {
    if (!products) return [];
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => matches(p, filter) && (!q || p.title.toLowerCase().includes(q)));
    const order = categories.map((c) => c.name);
    const names = [...new Set(list.map((p) => p.category))].sort(
      (a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999) || a.localeCompare(b),
    );
    return names.map((name) => ({
      title: name,
      data: list.filter((p) => p.category === name).sort((a, b) => a.title.localeCompare(b.title)),
    }));
  }, [products, categories, query, filter]);

  const stats = useMemo(() => {
    const l = products ?? [];
    return { visible: l.filter((p) => p.isActive).length, low: l.filter((p) => p.isActive && p.stockQuantity <= LOW_STOCK).length };
  }, [products]);

  if (!products) return <EmptyState title="Loading menu…" />;

  const renderItem = ({ item: p }: { item: ProductDTO }) => {
    const isBusy = busy.has(p.id);
    const info = (
      <Pressable onPress={() => navigation.navigate('EditItem', { id: p.id })} style={[ui.row, { gap: 12, flex: 1 }]}>
        <View style={{ width: 64, height: 48, borderRadius: 10, overflow: 'hidden', backgroundColor: '#e7e5e4' }}>
          {p.images[0] && <Image source={{ uri: p.images[0] }} style={{ width: '100%', height: '100%', opacity: p.isActive ? 1 : 0.4 }} />}
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[ui.body, { fontWeight: '700', color: p.isActive ? colors.text : colors.muted }]} numberOfLines={1}>
            {p.title}
          </Text>
          <View style={[ui.row, { gap: 4, flexWrap: 'wrap' }]}>
            {!p.isActive && <Badge label="Hidden" />}
            {p.compareAtPrice != null && <Badge label="On offer" tone="rose" />}
            {p.stockQuantity === 0 ? <Badge label="Sold out" tone="rose" /> : p.stockQuantity <= LOW_STOCK && <Badge label="Low stock" tone="amber" />}
            {p.images.length === 0 && <Badge label="Needs photo" tone="amber" />}
          </View>
        </View>
      </Pressable>
    );
    const controls = (
      <View style={[ui.row, { gap: isTablet ? 18 : 10, justifyContent: 'space-between' }]}>
        <View style={{ minWidth: 70 }}>
          <Text style={[ui.body, { fontWeight: '700' }]}>{formatPrice(p.price)}</Text>
          {p.compareAtPrice != null && <Text style={[ui.muted, { textDecorationLine: 'line-through' }]}>{formatPrice(p.compareAtPrice)}</Text>}
        </View>
        <Stepper value={p.stockQuantity} label={`stock of ${p.title}`} disabled={isBusy} onChange={(d) => mutate(p, `/products/${p.id}/stock`, { delta: d })} />
        {isTablet && <Text style={[ui.muted, { width: 56, textAlign: 'right' }]}>{p.soldCount} sold</Text>}
        <Switch
          value={p.isActive}
          disabled={isBusy}
          onValueChange={(v) => mutate(p, `/products/${p.id}`, { isActive: v })}
          trackColor={{ true: colors.success, false: '#d6d3d1' }}
          accessibilityLabel={`Show ${p.title} on the menu`}
        />
      </View>
    );
    return (
      <View style={{ backgroundColor: '#fff', paddingHorizontal: 14, paddingVertical: 12, gap: 10, opacity: isBusy ? 0.6 : 1, ...(isTablet && { flexDirection: 'row', alignItems: 'center' }) }}>
        {info}
        {controls}
      </View>
    );
  };

  return (
    <View style={ui.screen}>
      <View style={{ paddingHorizontal: pad, paddingTop: pad, gap: 10 }}>
        <Text style={ui.muted}>
          {stats.visible} on the menu · {products.length - stats.visible} hidden
          {stats.low > 0 ? ` · ${stats.low} low on stock` : ''}
        </Text>
        <TextInput style={ui.input} placeholder="Search menu items…" value={query} onChangeText={setQuery} clearButtonMode="while-editing" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 6 }}>
          {FILTERS.map((f) => (
            <Chip key={f.value} label={f.label} active={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </ScrollView>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(p) => p.id}
        stickySectionHeadersEnabled
        contentContainerStyle={{ padding: pad, paddingTop: 6 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load().catch(() => undefined);
              setRefreshing(false);
            }}
          />
        }
        renderSectionHeader={({ section }) => (
          <View style={[ui.row, { justifyContent: 'space-between', backgroundColor: colors.bg, paddingTop: 14, paddingBottom: 6 }]}>
            <Text style={[ui.h3, { textTransform: 'capitalize' }]}>{section.title}</Text>
            <Text style={ui.muted}>{section.data.length} items</Text>
          </View>
        )}
        renderItem={renderItem}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: colors.border }} />}
        ListEmptyComponent={<EmptyState title="No items match" body="Try another search or filter." />}
      />
    </View>
  );
}
