import type { Metadata } from 'next';
import Link from 'next/link';
import type { Paginated, ProductDTO } from '@store/shared';
import { ProductCard } from '@/components/ProductCard';
import { api } from '@/lib/api';

export const metadata: Metadata = { title: 'Menu' };

type SearchParams = Promise<{ category?: string; q?: string; sort?: string; page?: string; onSale?: string }>;

export default async function ShopPage({ searchParams }: { searchParams: SearchParams }) {
  const { category, q, sort, page, onSale } = await searchParams;
  const deals = onSale === 'true';

  const qs = new URLSearchParams();
  if (category) qs.set('category', category);
  if (q) qs.set('q', q);
  if (sort) qs.set('sort', sort);
  if (page) qs.set('page', page);
  if (deals) qs.set('onSale', 'true');

  const [products, categories] = await Promise.all([
    api<Paginated<ProductDTO>>(`/products?${qs}`, { next: { revalidate: 30 } }),
    api<string[]>('/products/categories', { next: { revalidate: 300 } }),
  ]);

  // Filter chips: switching category or deals resets search + pagination.
  const chips = [
    { label: 'All', href: '/shop', active: !category && !deals },
    { label: '🔥 Deals', href: '/shop?onSale=true', active: deals },
    ...categories.map((c) => ({ label: c, href: `/shop?category=${encodeURIComponent(c)}`, active: c === category })),
  ];

  const heading = deals ? "Today's deals" : category ? category : 'Our menu';

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-1">
          <p className="eyebrow">Order online</p>
          <h1 className="text-4xl font-bold capitalize">{heading}</h1>
          <p className="text-stone-500">
            {products.total} {products.total === 1 ? 'item' : 'items'}
          </p>
        </div>
        <form action="/shop" className="flex flex-wrap gap-2">
          {category && <input type="hidden" name="category" value={category} />}
          {deals && <input type="hidden" name="onSale" value="true" />}
          <input name="q" defaultValue={q} placeholder="Search the menu…" className="input sm:w-64" />
          <select name="sort" defaultValue={sort ?? 'newest'} className="input w-auto">
            <option value="newest">Newest</option>
            <option value="popular">Most popular</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
          <button className="btn-secondary">Apply</button>
        </form>
      </section>

      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Filter menu">
        {chips.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium capitalize transition ${
              c.active
                ? 'border-ink bg-ink text-white'
                : 'border-stone-300 bg-white text-stone-700 hover:border-stone-400'
            }`}
          >
            {c.label}
          </Link>
        ))}
      </nav>

      {products.data.length === 0 ? (
        <div className="py-20 text-center">
          <p className="mb-4 text-stone-500">Nothing matches that — try another search or category.</p>
          <Link href="/shop" className="btn-secondary">
            Show the full menu
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.data.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}

      {products.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {Array.from({ length: products.totalPages }, (_, i) => i + 1).map((n) => {
            const p = new URLSearchParams(qs);
            p.set('page', String(n));
            return (
              <Link
                key={n}
                href={`/shop?${p}`}
                className={`rounded-full px-4 py-2 text-sm ${n === products.page ? 'bg-ink text-white' : 'bg-white hover:bg-stone-100'}`}
              >
                {n}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
