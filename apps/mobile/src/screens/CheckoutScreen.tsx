import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import {
  DEFAULT_COUNTRY,
  normalizeAddress,
  validateAddress,
  type Address,
  type CheckoutResponse,
  type CreateOrderInput,
  type OrderDTO,
} from '@store/shared';
import { AddressForm, type AddressDraft, type Touched } from '../components/AddressForm';
import { Button } from '../components/Button';
import { StoreStatusBanner } from '../components/StoreStatusBanner';
import { useStoreInfo } from '../hooks/useStoreInfo';
import { api, ApiError } from '../lib/api';
import { formatPrice } from '../lib/format';
import type { RootScreenProps } from '../navigation/types';
import { useAuth } from '../store/auth';
import { cartTotal, useCart } from '../store/cart';
import { ui } from '../theme';

export function CheckoutScreen({ navigation }: RootScreenProps<'Checkout'>) {
  const token = useAuth((s) => s.token);
  const saved = useAuth((s) => s.user?.addresses[0]);
  const { items, clear } = useCart();
  const [address, setAddress] = useState<AddressDraft>(saved ?? { country: DEFAULT_COUNTRY });
  const [touched, setTouched] = useState<Touched>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const addressErrors = validateAddress(address);
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
    const invalid = Object.keys(addressErrors) as (keyof Address)[];
    if (invalid.length) {
      setTouched(Object.fromEntries(invalid.map((k) => [k, true])));
      setError('Please fix the highlighted fields above.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const body: CreateOrderInput = {
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      shippingAddress: normalizeAddress(address as Address),
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
        <AddressForm
          value={address}
          onChange={(next) => {
            setAddress(next);
            if (error) setError(null);
          }}
          errors={addressErrors}
          touched={touched}
          onBlur={(f) => setTouched((t) => ({ ...t, [f]: true }))}
        />

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
