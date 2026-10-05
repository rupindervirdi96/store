import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ProductDTO } from '@store/shared';
import { Button } from '../components/Button';
import { api } from '../lib/api';
import { formatPrice } from '../lib/format';
import type { RootScreenProps } from '../navigation/types';
import { useCart } from '../store/cart';
import { colors, ui } from '../theme';

export function ProductDetailScreen({ route, navigation }: RootScreenProps<'ProductDetail'>) {
  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const add = useCart((s) => s.add);

  useEffect(() => {
    api<ProductDTO>(`/products/${route.params.id}`)
      .then((p) => {
        setProduct(p);
        navigation.setOptions({ title: p.title });
      })
      .catch((e: Error) => setError(e.message));
  }, [route.params.id, navigation]);

  if (error) return <Text style={[ui.error, { padding: 16 }]}>{error}</Text>;
  if (!product) return <ActivityIndicator style={{ marginTop: 40 }} color={colors.brand} />;

  const soldOut = product.stockQuantity === 0;

  return (
    <SafeAreaView style={ui.screen} edges={['bottom']}>
      <ScrollView>
        <View style={{ aspectRatio: 1, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}>
          {product.images[0] ? (
            <Image source={{ uri: product.images[0] }} style={{ width: '100%', height: '100%' }} />
          ) : (
            <Text style={{ fontSize: 72 }}>🛍️</Text>
          )}
        </View>
        <View style={{ padding: 16, gap: 10 }}>
          <Text style={[ui.muted, { textTransform: 'uppercase' }]}>{product.category}</Text>
          <Text style={ui.h1}>{product.title}</Text>
          <Text style={[ui.h2, { fontSize: 22 }]}>{formatPrice(product.price)}</Text>
          <Text style={[ui.body, { lineHeight: 22, color: '#334155' }]}>{product.description}</Text>
          <Text style={{ color: soldOut ? colors.danger : product.stockQuantity <= 5 ? '#d97706' : colors.success }}>
            {soldOut ? 'Out of stock' : product.stockQuantity <= 5 ? `Only ${product.stockQuantity} left` : 'In stock'}
          </Text>
        </View>
      </ScrollView>
      <View style={{ padding: 16 }}>
        <Button
          title={soldOut ? 'Sold out' : 'Add to cart'}
          disabled={soldOut}
          onPress={() => {
            add(product);
            navigation.navigate('Tabs', { screen: 'Cart' });
          }}
        />
      </View>
    </SafeAreaView>
  );
}
