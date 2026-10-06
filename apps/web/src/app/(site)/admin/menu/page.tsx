'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CategoryDTO, Paginated, ProductDTO } from '@store/shared';
import { Badge, Toggle } from '@/components/admin/ui';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { api, ApiError, refreshStorefront } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useAuth } from '@/store/auth';

const LOW_STOCK = 5;
type Status = 'all' | 'visible' | 'hidden' | 'offer' | 'low';
const STATUSES: { value: Status; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'visible', label: 'On menu' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'offer', label: 'On offer' },
  { value: 'low', label: 'Low stock' },
];

const matchesStatus = (p: ProductDTO, s: Status) =>
  s === 'all' ||
  (s === 'visible' && p.isActive) ||
  (s === 'hidden' && !p.isActive) ||
  (s === 'offer' && p.compareAtPrice != null) ||
  (s === 'low' && p.stockQuantity <= LOW_STOCK);

export default function MenuAdminPage() {
  const token = useAuth((s) => s.token);
  const [products, setProducts] = useState<ProductDTO[] | null>(null);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<Status>('all');
  const [busy, setBusy] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      api<Paginated<ProductDTO>>('/products?includeInactive=true&limit=100', { token }),
      api<CategoryDTO[]>('/categories?includeInactive=true', { token }),
    ]);
    setProducts(p.data);
    setCategories(c);
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  // Stock changes from orders arrive live.
  useSocketEvent('product:stock', ({ id, stockQuantity }) =>
    setProducts((list) => list?.map((p) => (p.id === id ? { ...p, stockQuantity } : p)) ?? list),
  );

  async function mutate(p: ProductDTO, path: string, body: unknown) {
    setBusy((s) => new Set(s).add(p.id));
    try {
      const updated = await api<ProductDTO>(path, { method: 'PATCH', body, token });
      setProducts((list) => list?.map((x) => (x.id === updated.id ? updated : x)) ?? list);
      refreshStorefront(token);
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Update failed');
    } finally {
      setBusy((s) => {
        const next = new Set(s);
        next.delete(p.id);
        return next;
      });
    }
  }

  // Group the filtered list by category, in menu order.
  const groups = useMemo(() => {
    if (!products) return [];
    const q = query.trim().toLowerCase();
    const filtered = products.filter(
      (p) =>
        (category === 'all' || p.category === category) &&
        matchesStatus(p, status) &&
        (!q || p.title.toLowerCase().includes(q) || p.description.toLowerCase().includes(q)),
    );
    const order = categories.map((c) => c.name);
    const names = [...new Set(filtered.map((p) => p.category))].sort(
      (a, b) => (order.indexOf(a) + 1 || 999) - (order.indexOf(b) + 1 || 999) || a.localeCompare(b),
    );
    return names.map((name) => ({
      name,
      items: filtered.filter((p) => p.category === name).sort((a, b) => a.title.localeCompare(b.title)),
    }));
  }, [products, categories, query, category, status]);

  const stats = useMemo(() => {
    const list = products ?? [];
    return {
      total: list.length,
      visible: list.filter((p) => p.isActive).length,
      offers: list.filter((p) => p.compareAtPrice != null && p.isActive).length,
      low: list.filter((p) => p.isActive && p.stockQuantity <= LOW_STOCK).length,
    };
  }, [products]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Menu</h1>
          <p className="text-sm text-stone-500">
            {stats.visible} on the menu · {stats.total - stats.visible} hidden · {stats.offers} on offer
            {stats.low > 0 && <span className="font-medium text-amber-700"> · {stats.low} low on stock</span>}
          </p>
        </div>
        <Link href="/admin/menu/new" className="btn-primary">
          + Add menu item
        </Link>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-3">
        <input
          className="input max-w-xs flex-1"
          placeholder="Search items…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select className="input w-auto capitalize" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex flex-wrap gap-1">
          {STATUSES.map((s) => (
            <button
              key={s.value}
              onClick={() => setStatus(s.value)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                status === s.value ? 'bg-ink text-white' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {!products ? (
        <p className="py-12 text-center text-stone-500">Loading menu…</p>
      ) : groups.length === 0 ? (
        <div className="card py-16 text-center text-stone-500">No items match these filters.</div>
      ) : (
        groups.map((g) => (
          <section key={g.name} className="card overflow-hidden">
            <header className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-2.5">
              <h2 className="font-display text-sm font-semibold capitalize">{g.name}</h2>
              <span className="text-xs text-stone-500">
                {g.items.length} item{g.items.length === 1 ? '' : 's'}
              </span>
            </header>
            <ul className="divide-y divide-stone-100">
              {g.items.map((p) => (
                <li
                  key={p.id}
                  className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3 sm:flex-nowrap ${busy.has(p.id) ? 'opacity-60' : ''}`}
                >
                  <Link href={`/admin/menu/${p.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-lg bg-stone-100">
                      {p.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt="" className={`h-full w-full object-cover ${p.isActive ? '' : 'grayscale'}`} />
                      ) : (
                        <span className="flex h-full items-center justify-center text-xs text-stone-400">No photo</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className={`truncate font-semibold ${p.isActive ? '' : 'text-stone-400'}`}>{p.title}</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {!p.isActive && <Badge>Hidden</Badge>}
                        {p.compareAtPrice != null && <Badge tone="rose">On offer</Badge>}
                        {p.stockQuantity === 0 ? (
                          <Badge tone="rose">Sold out</Badge>
                        ) : (
                          p.stockQuantity <= LOW_STOCK && <Badge tone="amber">Low stock</Badge>
                        )}
                        {p.images.length === 0 && <Badge tone="amber">Needs photo</Badge>}
                      </div>
                    </div>
                  </Link>

                  <div className="w-28 text-right text-sm tabular-nums">
                    <p className="font-semibold">{formatPrice(p.price)}</p>
                    {p.compareAtPrice != null && <p className="text-xs text-stone-400 line-through">{formatPrice(p.compareAtPrice)}</p>}
                  </div>

                  <div className="flex items-center gap-1" title="Stock">
                    <button
                      className="h-8 w-8 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
                      onClick={() => mutate(p, `/products/${p.id}/stock`, { delta: -1 })}
                      disabled={p.stockQuantity === 0}
                      aria-label={`Decrease stock of ${p.title}`}
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-sm font-semibold tabular-nums">{p.stockQuantity}</span>
                    <button
                      className="h-8 w-8 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-100"
                      onClick={() => mutate(p, `/products/${p.id}/stock`, { delta: 1 })}
                      aria-label={`Increase stock of ${p.title}`}
                    >
                      +
                    </button>
                  </div>

                  <div className="hidden w-14 text-right text-xs text-stone-500 md:block">{p.soldCount} sold</div>

                  <Toggle
                    checked={p.isActive}
                    onChange={(v) => mutate(p, `/products/${p.id}`, { isActive: v })}
                    label={`Show ${p.title} on the menu`}
                  />

                  <Link href={`/admin/menu/${p.id}`} className="btn-secondary px-4 py-1.5">
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
