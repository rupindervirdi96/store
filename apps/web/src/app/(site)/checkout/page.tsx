'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Address, CreateOrderInput, OrderDTO } from '@store/shared';
import { RequireAuth } from '@/components/RequireAuth';
import { api, ApiError } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useAuth } from '@/store/auth';
import { cartTotal, useCart } from '@/store/cart';

const FIELDS: { name: keyof Address; label: string; required?: boolean; span?: boolean }[] = [
  { name: 'line1', label: 'Address line 1', required: true, span: true },
  { name: 'line2', label: 'Address line 2', span: true },
  { name: 'city', label: 'City', required: true },
  { name: 'state', label: 'State / Province', required: true },
  { name: 'postalCode', label: 'Postal code', required: true },
  { name: 'country', label: 'Country', required: true },
  { name: 'phone', label: 'Phone', span: true },
];

function CheckoutForm() {
  const router = useRouter();
  const token = useAuth((s) => s.token);
  const savedAddress = useAuth((s) => s.user?.addresses[0]);
  const { items, clear } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const form = new FormData(e.currentTarget);
    const shippingAddress = Object.fromEntries(
      FIELDS.map((f) => [f.name, String(form.get(f.name) ?? '').trim() || undefined]),
    ) as unknown as Address;

    const body: CreateOrderInput = {
      items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      shippingAddress,
    };

    try {
      // Payment integration point: create a Stripe PaymentIntent here (or
      // server-side on order creation) and confirm it before redirecting.
      const order = await api<OrderDTO>('/orders', { method: 'POST', body, token });
      clear();
      router.push(`/orders/${order.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong, please try again.');
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return <p className="py-24 text-center text-stone-500">Your cart is empty.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <section className="card space-y-4 p-6">
        <h1 className="text-xl font-semibold">Shipping address</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <label key={f.name} className={`space-y-1 text-sm ${f.span ? 'sm:col-span-2' : ''}`}>
              <span className="text-stone-600">
                {f.label}
                {f.required && ' *'}
              </span>
              <input name={f.name} required={f.required} defaultValue={savedAddress?.[f.name] ?? ''} className="input" />
            </label>
          ))}
        </div>
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
          {submitting ? 'Placing order…' : 'Place order'}
        </button>
      </aside>
    </form>
  );
}

export default function CheckoutPage() {
  return (
    <RequireAuth>
      <CheckoutForm />
    </RequireAuth>
  );
}
