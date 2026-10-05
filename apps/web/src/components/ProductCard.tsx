import Link from 'next/link';
import type { ProductDTO } from '@store/shared';
import { formatPrice } from '@/lib/format';
import { AddToCartButton } from './AddToCartButton';

export function ProductCard({ product }: { product: ProductDTO }) {
  return (
    <div className="card group flex flex-col overflow-hidden">
      <Link href={`/products/${product.id}`} className="block aspect-square overflow-hidden bg-slate-100">
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.images[0]}
            alt={product.title}
            className="h-full w-full object-cover transition group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-slate-300">🛍️</div>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <span className="text-xs uppercase tracking-wide text-slate-500">{product.category}</span>
        <Link href={`/products/${product.id}`} className="font-medium hover:text-brand-700">
          {product.title}
        </Link>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="font-semibold">{formatPrice(product.price)}</span>
          <AddToCartButton product={product} compact />
        </div>
      </div>
    </div>
  );
}
