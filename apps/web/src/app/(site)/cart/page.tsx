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
        <p className="mb-4 text-stone-500">Your cart is empty.</p>
        <Link href="/shop" className="btn-primary">
          Browse the menu
        </Link>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
      <section className="card divide-y divide-stone-100">
        {items.map((i) => (
          // Two levels so the row fits a phone: name + line total, then quantity + remove.
          <div key={i.productId} className="flex gap-3 p-4 sm:gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-stone-100 sm:h-20 sm:w-20">
              {i.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={i.image} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/products/${i.productId}`} className="font-medium leading-snug hover:text-brand-700">
                    {i.title}
                  </Link>
                  <p className="text-sm text-stone-500">{formatPrice(i.price)} each</p>
                </div>
                <p className="shrink-0 font-semibold tabular-nums">{formatPrice(i.price * i.quantity)}</p>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">
                  <button
                    className="btn-secondary h-8 w-8 p-0"
                    onClick={() => setQuantity(i.productId, i.quantity - 1)}
                    disabled={i.quantity <= 1}
                    aria-label={`Decrease ${i.title}`}
                  >
                    −
                  </button>
                  <span className="w-8 text-center tabular-nums">{i.quantity}</span>
                  <button
                    className="btn-secondary h-8 w-8 p-0"
                    onClick={() => setQuantity(i.productId, i.quantity + 1)}
                    disabled={i.quantity >= i.maxQuantity}
                    aria-label={`Increase ${i.title}`}
                  >
                    +
                  </button>
                </div>
                <button className="text-sm text-stone-500 hover:text-rose-600" onClick={() => remove(i.productId)}>
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </section>

      <aside className="card h-fit space-y-4 p-6">
        <div className="flex justify-between text-lg font-semibold">
          <span>Subtotal</span>
          <span>{formatPrice(cartTotal(items))}</span>
        </div>
        <p className="text-xs text-stone-500">Final prices and stock are confirmed at checkout.</p>
        <Link href="/checkout" className="btn-primary w-full py-3">
          Checkout
        </Link>
      </aside>
    </div>
  );
}
