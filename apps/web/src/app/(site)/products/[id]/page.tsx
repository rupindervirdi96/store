import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ProductDTO } from '@store/shared';
import { AddToCartButton } from '@/components/AddToCartButton';
import { discountPercent, Price } from '@/components/Price';
import { api, ApiError } from '@/lib/api';

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
  const off = discountPercent(product.price, product.compareAtPrice);

  return (
    <div className="space-y-6">
      <Link href="/shop" className="text-sm font-medium text-stone-500 hover:text-stone-800">
        ← Back to menu
      </Link>
      <div className="grid gap-10 md:grid-cols-2 md:items-center">
        <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-stone-100 shadow-lg">
          {product.images[0] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.images[0]} alt={product.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-7xl">🍔</div>
          )}
          {off > 0 && (
            <span className="absolute left-4 top-4 rounded-full bg-rose-600 px-3 py-1.5 text-sm font-bold text-white shadow">
              Save {off}%
            </span>
          )}
        </div>

        <div className="flex flex-col gap-5">
          <Link href={`/shop?category=${encodeURIComponent(product.category)}`} className="eyebrow hover:text-brand-900">
            {product.category}
          </Link>
          <h1 className="text-4xl font-bold sm:text-5xl">{product.title}</h1>
          <Price price={product.price} compareAtPrice={product.compareAtPrice} size="lg" />
          <p className="whitespace-pre-line text-lg leading-relaxed text-stone-600">{product.description}</p>
          <p
            className={`text-sm font-medium ${
              product.stockQuantity === 0 ? 'text-rose-600' : lowStock ? 'text-amber-600' : 'text-emerald-600'
            }`}
          >
            {product.stockQuantity === 0
              ? 'Sold out for today'
              : lowStock
                ? `Only ${product.stockQuantity} left today`
                : '● Available now'}
          </p>
          <div className="mt-2 max-w-sm">
            <AddToCartButton product={product} />
          </div>
        </div>
      </div>
    </div>
  );
}
