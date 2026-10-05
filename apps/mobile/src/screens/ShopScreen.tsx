import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Paginated, ProductDTO } from '@store/shared';
import { api } from '../lib/api';
import { formatPrice } from '../lib/format';
import type { TabScreenProps } from '../navigation/types';
import { colors, ui } from '../theme';

const PAGE_SIZE = 20;

export function ShopScreen({ navigation }: TabScreenProps<'Shop'>) {
  const [categories, setCategories] = useState<string[]>([]);
  const [category, setCategory] = useState<string | undefined>();
  const [query, setQuery] = useState('');
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(
    async (p: number, signal?: AbortSignal) => {
      const qs = new URLSearchParams({ page: String(p), limit: String(PAGE_SIZE) });
      if (category) qs.set('category', category);
      if (query.trim()) qs.set('q', query.trim());
      const res = await api<Paginated<ProductDTO>>(`/products?${qs}`, { signal });
      setProducts((prev) => (p === 1 ? res.data : [...prev, ...res.data]));
      setPage(res.page);
      setTotalPages(res.totalPages);
      setError(null);
    },
    [category, query],
  );

  // Debounced reload when filters change.
  useEffect(() => {
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      fetchPage(1, ctrl.signal)
        .catch((e: Error) => !ctrl.signal.aborted && setError(e.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [fetchPage]);

  useEffect(() => {
    api<string[]>('/products/categories').then(setCategories).catch(() => undefined);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPage(1).catch((e: Error) => setError(e.message));
    setRefreshing(false);
  };

  const onEndReached = () => {
    if (!loading && page < totalPages) {
      setLoading(true);
      fetchPage(page + 1)
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }
  };

  return (
    <View style={ui.screen}>
      <View style={{ padding: 16, paddingBottom: 8, gap: 12 }}>
        <TextInput
          style={ui.input}
          placeholder="Search products…"
          value={query}
          onChangeText={setQuery}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[undefined, ...categories].map((c) => {
            const active = c === category;
            return (
              <Pressable
                key={c ?? 'all'}
                onPress={() => setCategory(c)}
                style={[styles.chip, active && { backgroundColor: colors.brand, borderColor: colors.brand }]}
              >
                <Text style={{ color: active ? '#fff' : colors.text, textTransform: 'capitalize' }}>{c ?? 'All'}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {error && <Text style={[ui.error, { paddingHorizontal: 16 }]}>{error}</Text>}

      <FlatList
        data={products}
        keyExtractor={(p) => p.id}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={!loading ? <Text style={[ui.muted, { textAlign: 'center', marginTop: 40 }]}>No products found.</Text> : null}
        ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 16 }} color={colors.brand} /> : null}
        renderItem={({ item }) => (
          <Pressable
            style={styles.productCard}
            onPress={() => navigation.navigate('ProductDetail', { id: item.id, title: item.title })}
          >
            <View style={styles.imageWrap}>
              {item.images[0] ? (
                <Image source={{ uri: item.images[0] }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <Text style={{ fontSize: 36 }}>🛍️</Text>
              )}
            </View>
            <View style={{ padding: 10, gap: 4 }}>
              <Text style={ui.muted}>{item.category}</Text>
              <Text style={[ui.body, { fontWeight: '500' }]} numberOfLines={2}>
                {item.title}
              </Text>
              <Text style={[ui.body, { fontWeight: '700' }]}>{formatPrice(item.price)}</Text>
              {item.stockQuantity === 0 && <Text style={[ui.muted, { color: colors.danger }]}>Sold out</Text>}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
  },
  productCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  imageWrap: { aspectRatio: 1, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
});
