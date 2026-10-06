'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Paginated, ProductDTO } from '@store/shared';
import { useSocketEvent } from '@/hooks/useSocketEvent';
import { api, ApiError } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useAuth } from '@/store/auth';

type Draft = Partial<ProductDTO> & { id?: string };

export default function InventoryPage() {
  const token = useAuth((s) => s.token);
  const [products, setProducts] = useState<ProductDTO[]>([]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [filter, setFilter] = useState('');

  const load = useCallback(() => {
    api<Paginated<ProductDTO>>('/products?includeInactive=true&limit=100', { token }).then((r) =>
      setProducts(r.data),
    );
  }, [token]);
  useEffect(load, [load]);

  const replace = (p: ProductDTO) => setProducts((list) => list.map((x) => (x.id === p.id ? p : x)));

  // Stock moves when customers order or other admins edit; keep the table live.
  useSocketEvent('product:stock', ({ id, stockQuantity }) =>
    setProducts((list) => list.map((p) => (p.id === id ? { ...p, stockQuantity } : p))),
  );

  async function run<T>(fn: () => Promise<T>) {
    try {
      return await fn();
    } catch (e) {
      alert(e instanceof ApiError ? e.message : 'Request failed');
    }
  }

  const adjust = (p: ProductDTO, delta: number) =>
    run(async () => replace(await api(`/products/${p.id}/stock`, { method: 'PATCH', body: { delta }, token })));

  const toggleActive = (p: ProductDTO) =>
    run(async () =>
      replace(await api(`/products/${p.id}`, { method: 'PATCH', body: { isActive: !p.isActive }, token })),
    );

  const visible = products.filter(
    (p) => !filter || `${p.title} ${p.category}`.toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Inventory</h1>
        <div className="flex gap-2">
          <input className="input w-56" placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <button className="btn-primary" onClick={() => setEditing({})}>
            + New product
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-stone-50 text-left text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3 text-right">Sold</th>
              <th className="px-4 py-3 text-center">Stock</th>
              <th className="px-4 py-3 text-center">Active</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {visible.map((p) => (
              <tr key={p.id} className={p.isActive ? '' : 'bg-stone-50 text-stone-400'}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-12 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                      {p.images[0] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <span className="font-medium">{p.title}</span>
                  </div>
                </td>
                <td className="px-4 py-3 capitalize">{p.category}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatPrice(p.price)}
                  {p.compareAtPrice != null && (
                    <span className="ml-1.5 rounded bg-rose-100 px-1.5 py-0.5 text-xs font-semibold text-rose-700">
                      was {formatPrice(p.compareAtPrice)}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-stone-500">{p.soldCount}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-1">
                    <button className="btn-secondary px-2 py-0.5" onClick={() => adjust(p, -1)} disabled={p.stockQuantity === 0}>
                      −
                    </button>
                    <span
                      className={`w-12 text-center tabular-nums font-medium ${
                        p.stockQuantity === 0 ? 'text-rose-600' : p.stockQuantity <= 5 ? 'text-amber-600' : ''
                      }`}
                    >
                      {p.stockQuantity}
                    </span>
                    <button className="btn-secondary px-2 py-0.5" onClick={() => adjust(p, 1)}>
                      +
                    </button>
                    <button className="btn-secondary px-2 py-0.5 text-xs" onClick={() => adjust(p, 10)}>
                      +10
                    </button>
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    role="switch"
                    aria-checked={p.isActive}
                    onClick={() => toggleActive(p)}
                    className={`relative h-5 w-9 rounded-full transition ${p.isActive ? 'bg-emerald-500' : 'bg-stone-300'}`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition ${
                        p.isActive ? 'left-4.5' : 'left-0.5'
                      }`}
                    />
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button className="text-brand-700 hover:underline" onClick={() => setEditing(p)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductEditor
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            setProducts((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list]));
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ProductEditor({
  draft,
  onClose,
  onSaved,
}: {
  draft: Draft;
  onClose: () => void;
  onSaved: (p: ProductDTO) => void;
}) {
  const token = useAuth((s) => s.token);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isNew = !draft.id;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body = {
      title: String(f.get('title')),
      description: String(f.get('description')),
      category: String(f.get('category')),
      price: Number(f.get('price')),
      // Blank clears the offer.
      compareAtPrice: String(f.get('compareAtPrice') ?? '').trim() ? Number(f.get('compareAtPrice')) : null,
      images: String(f.get('images'))
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
      // Stock for existing products is changed via the atomic stock endpoint.
      ...(isNew && { stockQuantity: Number(f.get('stockQuantity')) }),
    };
    setSaving(true);
    setError(null);
    try {
      const saved = await api<ProductDTO>(isNew ? '/products' : `/products/${draft.id}`, {
        method: isNew ? 'POST' : 'PATCH',
        body,
        token,
      });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? `${err.message}${err.details ? `: ${JSON.stringify(err.details)}` : ''}` : 'Save failed');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-stone-900/40 p-4" onClick={onClose}>
      <form onSubmit={onSubmit} onClick={(e) => e.stopPropagation()} className="card w-full max-w-lg space-y-4 p-6">
        <h2 className="text-lg font-semibold">{isNew ? 'New product' : 'Edit product'}</h2>
        <label className="block space-y-1 text-sm">
          <span className="text-stone-600">Title</span>
          <input name="title" required defaultValue={draft.title} className="input" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-stone-600">Description</span>
          <textarea name="description" rows={3} defaultValue={draft.description} className="input" />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className="block space-y-1 text-sm">
            <span className="text-stone-600">Category</span>
            <input name="category" required defaultValue={draft.category} className="input" />
          </label>
          <label className="block space-y-1 text-sm">
            <span className="text-stone-600">Price</span>
            <input name="price" type="number" step="0.01" min="0" required defaultValue={draft.price} className="input" />
          </label>
        </div>
        <label className="block space-y-1 text-sm">
          <span className="text-stone-600">Original price — fill in to show this item as a special offer</span>
          <input
            name="compareAtPrice"
            type="number"
            step="0.01"
            min="0"
            placeholder="Leave blank if not on offer"
            defaultValue={draft.compareAtPrice ?? ''}
            className="input"
          />
        </label>
        {isNew && (
          <label className="block space-y-1 text-sm">
            <span className="text-stone-600">Initial stock</span>
            <input name="stockQuantity" type="number" min="0" step="1" defaultValue={0} className="input" />
          </label>
        )}
        <label className="block space-y-1 text-sm">
          <span className="text-stone-600">Images — URLs or /images/... paths (one per line)</span>
          <textarea name="images" rows={2} defaultValue={draft.images?.join('\n')} className="input font-mono text-xs" />
        </label>
        {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}
