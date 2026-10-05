import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ProductDTO } from '@store/shared';
import { AddToCartButton } from '@/components/AddToCartButton';
import { api, ApiError } from '@/lib/api';
import { formatPrice } from '@/lib/format';

type Params = Promise<{ id: string }>;

async function getProduct(id: string): Promise<ProductDTO> {
  try {
    return await api<ProductDTO>(`/products/${id}`, { next: { revalidate: 30 } });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const product = await getProduct((await params).id);
  return {
    title: product.title,
    description: product.description.slice(0, 160),
    openGraph: { images: product.images.slice(0, 1) },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const product = await getProduct((await params).id);
  const lowStock = product.stockQuantity > 0 && product.stockQuantity <= 5;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-slate-500 hover:text-slate-800">
        ← Back to shop
      </Link>
      <div className="grid gap-10 md:grid-cols-2">
        <div className="card aspect-square overflow-hidden bg-slate-100">
          {product.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-7xl text-slate-300">🛍️</div>
          )}
        </div>
        <div className="flex flex-col gap-4">
          <Link
            href={`/?category=${encodeURIComponent(product.category)}`}
            className="text-sm uppercase tracking-wide text-brand-700"
          >
            {product.category}
          </Link>
          <h1 className="text-3xl font-semibold tracking-tight">{product.title}</h1>
          <p className="text-2xl font-semibold">{formatPrice(product.price)}</p>
          <p className="whitespace-pre-line leading-relaxed text-slate-600">{product.description}</p>
          <p className={`text-sm ${product.stockQuantity === 0 ? 'text-rose-600' : lowStock ? 'text-amber-600' : 'text-emerald-600'}`}>
            {product.stockQuantity === 0
              ? 'Out of stock'
              : lowStock
                ? `Only ${product.stockQuantity} left`
                : 'In stock'}
          </p>
          <div className="mt-4 max-w-sm">
            <AddToCartButton product={product} />
          </div>
        </div>
      </div>
    </div>
  );
}
