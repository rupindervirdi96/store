import Link from 'next/link';
import type { Paginated, ProductDTO } from '@store/shared';
import { ProductCard } from '@/components/ProductCard';
import { api } from '@/lib/api';

type SearchParams = Promise<{ category?: string; q?: string; sort?: string; page?: string }>;

export default async function CatalogPage({ searchParams }: { searchParams: SearchParams }) {
  const { category, q, sort, page } = await searchParams;

  const qs = new URLSearchParams();
  if (category) qs.set('category', category);
  if (q) qs.set('q', q);
  if (sort) qs.set('sort', sort);
  if (page) qs.set('page', page);

  const [products, categories] = await Promise.all([
    api<Paginated<ProductDTO>>(`/products?${qs}`, { next: { revalidate: 30 } }),
    api<string[]>('/products/categories', { next: { revalidate: 300 } }),
  ]);

  const hrefFor = (overrides: Record<string, string | undefined>) => {
    const p = new URLSearchParams({ ...(category && { category }), ...(q && { q }), ...(sort && { sort }) });
    for (const [k, v] of Object.entries(overrides)) (v ? p.set(k, v) : p.delete(k));
    p.delete('page');
    const s = p.toString();
    return s ? `/?${s}` : '/';
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Shop</h1>
          <p className="text-slate-500">{products.total} products</p>
        </div>
        <form action="/" className="flex gap-2">
          {category && <input type="hidden" name="category" value={category} />}
          <input name="q" defaultValue={q} placeholder="Search products…" className="input sm:w-64" />
          <select name="sort" defaultValue={sort ?? 'newest'} className="input w-auto">
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
          <button className="btn-secondary">Go</button>
        </form>
      </section>

      <nav className="flex flex-wrap gap-2" aria-label="Categories">
        {[undefined, ...categories].map((c) => {
          const active = c === category;
          return (
            <Link
              key={c ?? 'all'}
              href={hrefFor({ category: c })}
              className={`rounded-full border px-4 py-1.5 text-sm capitalize transition ${
                active
                  ? 'border-brand-600 bg-brand-600 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              }`}
            >
              {c ?? 'All'}
            </Link>
          );
        })}
      </nav>

      {products.data.length === 0 ? (
        <p className="py-16 text-center text-slate-500">No products match your filters.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
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
                href={`/?${p}`}
                className={`rounded-lg px-3 py-1.5 text-sm ${
                  n === products.page ? 'bg-slate-900 text-white' : 'bg-white hover:bg-slate-100'
                }`}
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
