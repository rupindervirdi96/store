import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import type { Address, CreateOrderInput, OrderDTO } from '@store/shared';
import { Button } from '../components/Button';
import { api, ApiError } from '../lib/api';
import { formatPrice } from '../lib/format';
import type { RootScreenProps } from '../navigation/types';
import { useAuth } from '../store/auth';
import { cartTotal, useCart } from '../store/cart';
import { ui } from '../theme';

const FIELDS: { key: keyof Address; label: string; required?: boolean }[] = [
  { key: 'line1', label: 'Address line 1', required: true },
  { key: 'line2', label: 'Address line 2' },
  { key: 'city', label: 'City', required: true },
  { key: 'state', label: 'State / Province', required: true },
  { key: 'postalCode', label: 'Postal code', required: true },
  { key: 'country', label: 'Country', required: true },
  { key: 'phone', label: 'Phone' },
];

export function CheckoutScreen({ navigation }: RootScreenProps<'Checkout'>) {
  const token = useAuth((s) => s.token);
  const saved = useAuth((s) => s.user?.addresses[0]);
  const { items, clear } = useCart();
  const [address, setAddress] = useState<Partial<Address>>(saved ?? {});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const missing = FIELDS.filter((f) => f.required && !address[f.key]?.trim());

  async function placeOrder() {
    if (missing.length) {
      setError(`Please fill in: ${missing.map((m) => m.label).join(', ')}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    const body: CreateOrderInput = {
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      shippingAddress: Object.fromEntries(
        Object.entries(address).map(([k, v]) => [k, v?.trim() || undefined]),
      ) as unknown as Address,
    };
    try {
      const order = await api<OrderDTO>('/orders', { method: 'POST', body, token });
      // Cart is only cleared once the server has accepted the order; on a
      // network failure it stays intact (and persisted) for a retry.
      clear();
      navigation.reset({
        index: 1,
        routes: [{ name: 'Tabs', params: { screen: 'Orders' } }, { name: 'OrderTracking', params: { id: order.id } }],
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not place order');
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={ui.h2}>Shipping address</Text>
        {FIELDS.map((f) => (
          <TextInput
            key={f.key}
            style={ui.input}
            placeholder={f.label + (f.required ? ' *' : '')}
            value={address[f.key] ?? ''}
            onChangeText={(v) => setAddress((a) => ({ ...a, [f.key]: v }))}
            keyboardType={f.key === 'phone' ? 'phone-pad' : 'default'}
            autoComplete={f.key === 'postalCode' ? 'postal-code' : f.key === 'phone' ? 'tel' : undefined}
          />
        ))}

        <View style={[ui.card, { gap: 6, marginTop: 8 }]}>
          <Text style={ui.h2}>Summary</Text>
          {items.map((i) => (
            <View key={i.productId} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={ui.muted}>
                {i.quantity} × {i.title}
              </Text>
              <Text style={ui.muted}>{formatPrice(i.price * i.quantity)}</Text>
            </View>
          ))}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text style={ui.h2}>Total</Text>
            <Text style={ui.h2}>{formatPrice(cartTotal(items))}</Text>
          </View>
        </View>

        {error && <Text style={ui.error}>{error}</Text>}
        <Button title="Place order" onPress={placeOrder} loading={submitting} disabled={items.length === 0} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
