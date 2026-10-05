import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../components/Button';
import { formatPrice } from '../lib/format';
import type { TabScreenProps } from '../navigation/types';
import { useAuth } from '../store/auth';
import { cartTotal, useCart } from '../store/cart';
import { colors, ui } from '../theme';

export function CartScreen({ navigation }: TabScreenProps<'Cart'>) {
  const { items, setQuantity, remove } = useCart();
  const user = useAuth((s) => s.user);

  if (items.length === 0) {
    return (
      <View style={[ui.screen, { alignItems: 'center', justifyContent: 'center', gap: 16 }]}>
        <Text style={ui.muted}>Your cart is empty.</Text>
        <Button title="Browse products" onPress={() => navigation.navigate('Shop')} />
      </View>
    );
  }

  return (
    <View style={ui.screen}>
      <FlatList
        data={items}
        keyExtractor={(i) => i.productId}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        renderItem={({ item }) => (
          <View style={[ui.card, styles.row]}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[ui.body, { fontWeight: '600' }]}>{item.title}</Text>
              <Text style={ui.muted}>{formatPrice(item.price)}</Text>
              <Pressable onPress={() => remove(item.productId)} hitSlop={8}>
                <Text style={[ui.muted, { color: colors.danger, marginTop: 4 }]}>Remove</Text>
              </Pressable>
            </View>
            <View style={styles.stepper}>
              <Pressable style={styles.stepBtn} onPress={() => setQuantity(item.productId, item.quantity - 1)}>
                <Text style={styles.stepTxt}>−</Text>
              </Pressable>
              <Text style={[ui.body, { minWidth: 24, textAlign: 'center' }]}>{item.quantity}</Text>
              <Pressable
                style={[styles.stepBtn, item.quantity >= item.maxQuantity && { opacity: 0.4 }]}
                disabled={item.quantity >= item.maxQuantity}
                onPress={() => setQuantity(item.productId, item.quantity + 1)}
              >
                <Text style={styles.stepTxt}>+</Text>
              </Pressable>
            </View>
          </View>
        )}
      />
      <View style={styles.footer}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={ui.h2}>Subtotal</Text>
          <Text style={ui.h2}>{formatPrice(cartTotal(items))}</Text>
        </View>
        <Button
          title={user ? 'Checkout' : 'Sign in to checkout'}
          onPress={() => navigation.navigate(user ? 'Checkout' : 'Login')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepTxt: { fontSize: 18, color: colors.text },
  footer: { padding: 16, gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: '#fff' },
});
