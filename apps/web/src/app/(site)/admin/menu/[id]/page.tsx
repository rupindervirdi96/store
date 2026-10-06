'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { CategoryDTO, ProductDTO } from '@store/shared';
import { ImageManager } from '@/components/admin/ImageManager';
import { Field, Panel, Toggle } from '@/components/admin/ui';
import { discountPercent, Price } from '@/components/Price';
import { api, ApiError, refreshStorefront } from '@/lib/api';
import { useAuth } from '@/store/auth';

interface Draft {
  title: string;
  description: string;
  category: string;
  price: string;
  compareAtPrice: string;
  images: string[];
  isActive: boolean;
  stockQuantity: string; // new items only; existing stock uses the atomic endpoint
}

const NEW_CATEGORY = '__new__';

const toDraft = (p?: ProductDTO): Draft => ({
  title: p?.title ?? '',
  description: p?.description ?? '',
  category: p?.category ?? '',
  price: p ? String(p.price) : '',
  compareAtPrice: p?.compareAtPrice != null ? String(p.compareAtPrice) : '',
  images: p?.images ?? [],
  isActive: p?.isActive ?? true,
  stockQuantity: '50',
});

const money = (v: string) => (v.trim() === '' ? null : Math.round(Number(v) * 100) / 100);

export default function EditMenuItemPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const token = useAuth((s) => s.token);

  const [product, setProduct] = useState<ProductDTO | null>(null);
  const [categories, setCategories] = useState<CategoryDTO[]>([]);
  const [draft, setDraft] = useState<Draft>(toDraft());
  const [initial, setInitial] = useState<Draft>(toDraft());
  const [newCategory, setNewCategory] = useState('');
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [stockInput, setStockInput] = useState('');

  useEffect(() => {
    api<CategoryDTO[]>('/categories?includeInactive=true', { token }).then(setCategories).catch(() => undefined);
    if (isNew) return;
    api<ProductDTO>(`/products/${id}`, { token })
      .then((p) => {
        setProduct(p);
        setDraft(toDraft(p));
        setInitial(toDraft(p));
        setStockInput(String(p.stockQuantity));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Could not load item'))
      .finally(() => setLoading(false));
  }, [id, isNew, token]);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(initial) || newCategory !== '', [draft, initial, newCategory]);

  // Warn before leaving with unsaved changes.
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const price = money(draft.price);
  const compareAt = money(draft.compareAtPrice);
  const offerError = compareAt != null && price != null && compareAt <= price ? 'Must be higher than the price' : undefined;
  const categoryName = draft.category === NEW_CATEGORY ? newCategory.trim().toLowerCase() : draft.category;

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!categoryName) return setError('Choose a category');
    if (price == null || Number.isNaN(price)) return setError('Enter a price');
    if (offerError) return setError(`Original price: ${offerError.toLowerCase()}`);

    const body = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      category: categoryName,
      price,
      compareAtPrice: compareAt,
      images: draft.images,
      isActive: draft.isActive,
      ...(isNew && { stockQuantity: Math.max(0, Math.floor(Number(draft.stockQuantity) || 0)) }),
    };

    setSaving(true);
    try {
      const saved = await api<ProductDTO>(isNew ? '/products' : `/products/${id}`, {
        method: isNew ? 'POST' : 'PATCH',
        body,
        token,
      });
      refreshStorefront(token);
      const next = toDraft(saved);
      setProduct(saved);
      setDraft(next);
      setInitial(next);
      setNewCategory('');
      setStockInput(String(saved.stockQuantity));
      // The page remounts for the new id, so pass the success message via the URL.
      if (isNew) router.replace(`/admin/menu/${saved.id}?created=1`);
      else setNotice('Changes saved');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function setStock() {
    const value = Math.floor(Number(stockInput));
    if (!product || Number.isNaN(value) || value < 0) return;
    try {
      const updated = await api<ProductDTO>(`/products/${product.id}/stock`, { method: 'PATCH', body: { set: value }, token });
      setProduct(updated);
      setStockInput(String(updated.stockQuantity));
      refreshStorefront(token);
      setNotice(`Stock set to ${updated.stockQuantity}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update stock');
    }
  }

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has('created')) setNotice('Item created and added to the menu');
  }, []);

  if (loading) return <p className="py-12 text-center text-stone-500">Loading…</p>;
  if (!isNew && !product) return <p className="py-12 text-center text-rose-600">{error ?? 'Item not found'}</p>;

  const off = discountPercent(price ?? 0, compareAt);

  return (
    <form onSubmit={save} className="space-y-6 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/menu" className="text-sm font-medium text-stone-500 hover:text-stone-800">
            ← Menu
          </Link>
          <h1 className="mt-1 text-3xl font-bold">{isNew ? 'New menu item' : draft.title || 'Untitled item'}</h1>
        </div>
        {product && product.isActive && (
          <Link href={`/products/${product.id}`} target="_blank" className="btn-secondary">
            View on site ↗
          </Link>
        )}
      </div>

      {notice && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{notice}</p>}
      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Panel title="Photos" description="Shown on the menu and product page. Drag in several and pick the best as the cover.">
            <ImageManager value={draft.images} onChange={(v) => set('images', v)} />
          </Panel>

          <Panel title="Details">
            <Field label="Name">
              <input className="input" required maxLength={200} value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. Classic Cheeseburger" />
            </Field>
            <Field label="Description" hint={`${draft.description.length}/5000 · ingredients, allergens, what makes it special`}>
              <textarea className="input min-h-28" maxLength={5000} value={draft.description} onChange={(e) => set('description', e.target.value)} />
            </Field>
            <Field label="Category">
              <select className="input capitalize" required value={draft.category} onChange={(e) => set('category', e.target.value)}>
                <option value="" disabled>
                  Choose a category…
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                    {!c.isActive ? ' (hidden)' : ''}
                  </option>
                ))}
                {draft.category && !categories.some((c) => c.name === draft.category) && draft.category !== NEW_CATEGORY && (
                  <option value={draft.category}>{draft.category}</option>
                )}
                <option value={NEW_CATEGORY}>+ New category…</option>
              </select>
            </Field>
            {draft.category === NEW_CATEGORY && (
              <Field label="New category name" hint="Created when you save. Add a photo for it under Categories.">
                <input className="input" required value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Wraps" />
              </Field>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Pricing">
            <Field label="Price">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                <input className="input pl-7" type="number" step="0.01" min="0" required value={draft.price} onChange={(e) => set('price', e.target.value)} />
              </div>
            </Field>
            <Field label="Original price (optional)" hint="Fill in to show this item as a special offer." error={offerError}>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400">$</span>
                <input className="input pl-7" type="number" step="0.01" min="0" value={draft.compareAtPrice} onChange={(e) => set('compareAtPrice', e.target.value)} placeholder="Not on offer" />
              </div>
            </Field>
            {price != null && !Number.isNaN(price) && (
              <div className="rounded-xl bg-cream p-3 text-sm">
                <p className="mb-1 text-xs font-medium uppercase tracking-wider text-stone-500">Customers see</p>
                <div className="flex items-center gap-2">
                  <Price price={price} compareAtPrice={offerError ? null : compareAt} />
                  {off > 0 && !offerError && <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">−{off}%</span>}
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Stock">
            {isNew ? (
              <Field label="Starting stock">
                <input className="input" type="number" min="0" step="1" value={draft.stockQuantity} onChange={(e) => set('stockQuantity', e.target.value)} />
              </Field>
            ) : (
              <>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-stone-500">In stock now</span>
                  <span className="font-display text-2xl font-bold tabular-nums">{product!.stockQuantity}</span>
                </div>
                <div className="flex gap-2">
                  <input className="input" type="number" min="0" step="1" value={stockInput} onChange={(e) => setStockInput(e.target.value)} aria-label="New stock level" />
                  <button type="button" className="btn-secondary shrink-0" onClick={setStock} disabled={stockInput === String(product!.stockQuantity)}>
                    Set stock
                  </button>
                </div>
                <p className="text-xs text-stone-500">Updates immediately. Orders reduce stock automatically. {product!.soldCount} sold so far.</p>
              </>
            )}
          </Panel>

          <Panel
            title="Visibility"
            description={draft.isActive ? 'Customers can see and order this item.' : 'Hidden from customers. Past orders are unaffected.'}
            aside={<Toggle checked={draft.isActive} onChange={(v) => set('isActive', v)} label="Show on menu" />}
          />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur">
        <div className="container-page flex items-center justify-end gap-3 py-3">
          <span className="mr-auto text-sm text-stone-500">{dirty ? 'Unsaved changes' : isNew ? '' : 'All changes saved'}</span>
          <Link href="/admin/menu" className="btn-secondary">
            {dirty ? 'Discard' : 'Back'}
          </Link>
          <button className="btn-primary" disabled={saving || (!dirty && !isNew)}>
            {saving ? 'Saving…' : isNew ? 'Create item' : 'Save changes'}
          </button>
        </div>
      </div>
    </form>
  );
}
