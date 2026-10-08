'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  DEFAULT_COUNTRY,
  normalizeAddress,
  validateAddress,
  type Address,
  type CheckoutResponse,
  type CreateOrderInput,
} from '@store/shared';
import { AddressFields, type AddressDraft } from '@/components/AddressFields';
import { RequireAuth } from '@/components/RequireAuth';
import { api, ApiError } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { cartTotal, useCart } from '@/store/cart';

function CheckoutForm() {
  const token = useAuth((s) => s.token);
  const savedAddress = useAuth((s) => s.user?.addresses[0]);
  const { items } = useCart();
  const [address, setAddress] = useState<AddressDraft>(() => savedAddress ?? { country: DEFAULT_COUNTRY });
  const [touched, setTouched] = useState<Partial<Record<keyof Address, boolean>>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const addressErrors = validateAddress(address);

  // Back from Stripe via "←" / cancel: release the reserved order. The cart is untouched.
  useEffect(() => {
    const cancelled = new URLSearchParams(window.location.search).get('cancelled');
    if (!cancelled || !/^[a-f0-9]{24}$/.test(cancelled)) return;
    window.history.replaceState(null, '', '/checkout');
    setNotice('Payment was cancelled — nothing was charged. Your cart is still here.');
    void api(`/orders/${cancelled}/cancel`, { method: 'POST', token }).catch(() => undefined);
  }, [token]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const invalid = Object.keys(addressErrors) as (keyof Address)[];
    if (invalid.length) {
      setTouched(Object.fromEntries(invalid.map((k) => [k, true])));
      document.querySelector<HTMLElement>(`[name="${invalid[0]}"]`)?.focus();
      return;
    }
    setSubmitting(true);

    const body: CreateOrderInput = {
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      shippingAddress: normalizeAddress(address as Address),
    };

    try {
      // Stock is reserved and the order waits for payment on Stripe's page.
      // The cart is cleared only once payment succeeds (on the order page).
      const { checkoutUrl } = await api<CheckoutResponse>('/orders', { method: 'POST', body, token });
      window.location.assign(checkoutUrl);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again.');
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return <p className="py-24 text-center text-stone-500">Your cart is empty.</p>;
  }

  return (
    <div className="space-y-6">
    {notice && <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">{notice}</p>}
    <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <section className="card space-y-4 p-6">
        <h1 className="text-xl font-semibold">Shipping address</h1>
        <AddressFields
          value={address}
          onChange={setAddress}
          errors={addressErrors}
          touched={touched}
          onBlur={(f) => setTouched((t) => ({ ...t, [f]: true }))}
        />
      </section>

      <aside className="card h-fit space-y-4 p-6">
        <h2 className="font-semibold">Order summary</h2>
        <ul className="space-y-2 text-sm">
          {items.map((i) => (
            <li key={i.productId} className="flex justify-between gap-2">
              <span className="text-stone-600">
                {i.quantity} × {i.title}
              </span>
              <span className="tabular-nums">{formatPrice(i.price * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <div className="flex justify-between border-t border-stone-100 pt-4 text-lg font-semibold">
          <span>Total</span>
          <span>{formatPrice(cartTotal(items))}</span>
        </div>
        {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <button className="btn-primary w-full py-3" disabled={submitting}>
          {submitting ? 'Taking you to payment…' : `Pay ${formatPrice(cartTotal(items))}`}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-stone-500">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5" aria-hidden>
            <path fillRule="evenodd" d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z" clipRule="evenodd" />
          </svg>
          Secure payment by Stripe. Card, Apple Pay &amp; Google Pay.
        </p>
      </aside>
    </form>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <RequireAuth>
      <CheckoutForm />
    </RequireAuth>
  );
}
