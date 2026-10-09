import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import type { Address, CheckoutResponse, CreateOrderInput, OrderDTO } from '@store/shared';
import { Button } from '../components/Button';
import { StoreStatusBanner } from '../components/StoreStatusBanner';
import { useStoreInfo } from '../hooks/useStoreInfo';
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
  const storeInfo = useStoreInfo();
  const closed = storeInfo ? !storeInfo.status.isOpen : false;

  async function waitForPayment(orderId: string): Promise<OrderDTO | null> {
    let latest: OrderDTO | null = null;
    for (let i = 0; i < 4; i++) {
      latest = await api<OrderDTO>(`/orders/${orderId}`, { token }).catch(() => latest);
      if (latest && latest.status !== 'Awaiting Payment') break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    return latest;
  }

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
      returnTo: 'app',
    };
    try {
      const { order, checkoutUrl } = await api<CheckoutResponse>('/orders', { method: 'POST', body, token });
      // Stripe's secure page opens in an in-app browser; this resolves when it's closed.
      await WebBrowser.openBrowserAsync(checkoutUrl, { dismissButtonStyle: 'done' });

      // Stripe's confirmation usually lands within a few seconds of paying.
      const latest = await waitForPayment(order.id);
      // The cart is only cleared once payment is confirmed; otherwise it stays for a retry.
      if (latest?.paymentStatus === 'Paid') clear();
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

        {closed && <StoreStatusBanner info={storeInfo} />}
        {error && <Text style={ui.error}>{error}</Text>}
        <Button
          title={closed ? 'Ordering unavailable' : `Pay ${formatPrice(cartTotal(items))}`}
          onPress={placeOrder}
          loading={submitting}
          disabled={items.length === 0 || closed}
        />
        <Text style={[ui.muted, { textAlign: 'center' }]}>Secure payment by Stripe — card, Apple Pay or Google Pay.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
