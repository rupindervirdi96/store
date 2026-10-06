import Link from 'next/link';
import type { ProductDTO } from '@store/shared';
import { AddToCartButton } from './AddToCartButton';
import { discountPercent, Price } from './Price';

export function ProductCard({ product, badge }: { product: ProductDTO; badge?: string }) {
  const off = discountPercent(product.price, product.compareAtPrice);
  const soldOut = product.stockQuantity <= 0;

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-stone-900/10">
      <Link href={`/products/${product.id}`} className="relative block aspect-[4/3] overflow-hidden bg-stone-100">
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.images[0]}
            alt={product.title}
            loading="lazy"
            className={`h-full w-full object-cover transition duration-500 group-hover:scale-110 ${soldOut ? 'grayscale' : ''}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-5xl">🍔</div>
        )}
        <div className="absolute left-3 top-3 flex gap-1.5">
          {off > 0 && (
            <span className="rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white shadow">−{off}%</span>
          )}
          {badge && (
            <span className="rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-ink shadow">{badge}</span>
          )}
        </div>
        {soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1.5 text-center text-xs font-semibold uppercase tracking-wider text-white">
            Sold out
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">{product.category}</span>
        <Link href={`/products/${product.id}`} className="font-display text-base font-semibold leading-snug hover:text-brand-700">
          {product.title}
        </Link>
        <p className="line-clamp-2 text-sm text-stone-500">{product.description}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <Price price={product.price} compareAtPrice={product.compareAtPrice} />
          <AddToCartButton product={product} compact />
        </div>
      </div>
    </article>
  );
}
