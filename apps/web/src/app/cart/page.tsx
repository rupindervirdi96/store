'use client';

import Link from 'next/link';
import { useHydrated } from '@/hooks/useHydrated';
import { formatPrice } from '@/lib/format';
import { cartTotal, useCart } from '@/store/cart';

export default function CartPage() {
  const hydrated = useHydrated();
  const { items, setQuantity, remove } = useCart();

  if (!hydrated) return null;

  if (items.length === 0) {
    return (
      <div className="py-24 text-center">
        <p className="mb-4 text-slate-500">Your cart is empty.</p>
        <Link href="/" className="btn-primary">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <section className="card divide-y divide-slate-100">
        {items.map((i) => (
          <div key={i.productId} className="flex items-center gap-4 p-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
              {i.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.image} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="flex-1">
              <Link href={`/products/${i.productId}`} className="font-medium hover:text-brand-700">
                {i.title}
              </Link>
              <p className="text-sm text-slate-500">{formatPrice(i.price)}</p>
            </div>
            <div className="flex items-center gap-1">
              <button className="btn-secondary px-2.5 py-1" onClick={() => setQuantity(i.productId, i.quantity - 1)} aria-label="Decrease">
                −
              </button>
              <span className="w-8 text-center tabular-nums">{i.quantity}</span>
              <button
                className="btn-secondary px-2.5 py-1"
                onClick={() => setQuantity(i.productId, i.quantity + 1)}
                disabled={i.quantity >= i.maxQuantity}
                aria-label="Increase"
              >
                +
              </button>
            </div>
            <p className="w-20 text-right font-medium tabular-nums">{formatPrice(i.price * i.quantity)}</p>
            <button className="text-sm text-slate-400 hover:text-rose-600" onClick={() => remove(i.productId)}>
              Remove
            </button>
          </div>
        ))}
      </section>

      <aside className="card h-fit space-y-4 p-6">
        <div className="flex justify-between text-lg font-semibold">
          <span>Subtotal</span>
          <span>{formatPrice(cartTotal(items))}</span>
        </div>
        <p className="text-xs text-slate-500">Final prices and stock are confirmed at checkout.</p>
        <Link href="/checkout" className="btn-primary w-full py-3">
          Checkout
        </Link>
      </aside>
    </div>
  );
}
