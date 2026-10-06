'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { CategoryDTO } from '@store/shared';
import { ImageManager } from '@/components/admin/ImageManager';
import { Badge, Panel, Toggle } from '@/components/admin/ui';
import { api, ApiError, refreshStorefront } from '@/lib/api';
import { useAuth } from '@/store/auth';

export default function CategoriesAdminPage() {
  const token = useAuth((s) => s.token);
  const [categories, setCategories] = useState<CategoryDTO[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setCategories(await api<CategoryDTO[]>('/categories?includeInactive=true', { token }));
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try {
      await fn();
      refreshStorefront(token);
      await load();
      return true;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong');
      return false;
    }
  }

  const patch = (c: CategoryDTO, body: Partial<Pick<CategoryDTO, 'name' | 'image' | 'isActive'>>) =>
    run(() => api(`/categories/${c.id}`, { method: 'PATCH', body, token }));

  const move = (index: number, dir: -1 | 1) => {
    if (!categories) return;
    const ids = categories.map((c) => c.id);
    [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
    void run(() => api('/categories/order', { method: 'PUT', body: { ids }, token }));
  };

  const remove = (c: CategoryDTO) => {
    if (confirm(`Delete the "${c.name}" category?`)) void run(() => api(`/categories/${c.id}`, { method: 'DELETE', token }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Categories</h1>
        <p className="text-sm text-stone-500">
          Sections of your menu. The order here is the order on the website, and each photo is used for the home page tiles.
        </p>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="card divide-y divide-stone-100 overflow-hidden">
          {!categories ? (
            <p className="p-8 text-center text-stone-500">Loading…</p>
          ) : categories.length === 0 ? (
            <p className="p-8 text-center text-stone-500">No categories yet — add your first one.</p>
          ) : (
            categories.map((c, i) =>
              editing === c.id ? (
                <EditRow
                  key={c.id}
                  category={c}
                  onCancel={() => setEditing(null)}
                  onSave={async (body) => {
                    if (await patch(c, body)) setEditing(null);
                  }}
                />
              ) : (
                // Phones: details on top, controls below. Wider: one row.
                <div key={c.id} className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:gap-4">
                  <div className="flex min-w-0 items-center gap-3 md:flex-1 md:gap-4">
                  <div className="flex flex-col">
                    <button
                      className="rounded px-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:invisible"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label={`Move ${c.name} up`}
                    >
                      ▲
                    </button>
                    <button
                      className="rounded px-1.5 text-stone-400 hover:bg-stone-100 hover:text-stone-700 disabled:invisible"
                      onClick={() => move(i, 1)}
                      disabled={i === categories.length - 1}
                      aria-label={`Move ${c.name} down`}
                    >
                      ▼
                    </button>
                  </div>
                  <div className="h-16 w-20 shrink-0 overflow-hidden rounded-lg bg-stone-100">
                    {c.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image} alt="" className={`h-full w-full object-cover ${c.isActive ? '' : 'grayscale'}`} />
                    ) : (
                      <span className="flex h-full items-center justify-center text-xs text-stone-400">No photo</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold capitalize">{c.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-stone-500">
                      <Link href={`/admin/menu`} className="hover:underline">
                        {c.productCount} item{c.productCount === 1 ? '' : 's'}
                      </Link>
                      {!c.isActive && <Badge>Hidden</Badge>}
                      {!c.image && (
                        <Badge tone="amber">{c.productCount > 0 ? 'No photo — using an item photo' : 'No photo'}</Badge>
                      )}
                    </div>
                  </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 md:gap-3">
                  <Toggle checked={c.isActive} onChange={(v) => void patch(c, { isActive: v })} label={`Show ${c.name}`} />
                  <button className="btn-secondary px-4 py-1.5" onClick={() => setEditing(c.id)}>
                    Edit
                  </button>
                  <button
                    className="btn px-3 py-1.5 text-rose-600 hover:bg-rose-50 disabled:text-stone-300 disabled:hover:bg-transparent"
                    onClick={() => remove(c)}
                    disabled={c.productCount > 0}
                    title={c.productCount > 0 ? 'Move or hide its items first' : 'Delete category'}
                  >
                    Delete
                  </button>
                  </div>
                </div>
              ),
            )
          )}
        </div>

        <NewCategory onCreate={(body) => run(() => api('/categories', { method: 'POST', body, token }))} />
      </div>
    </div>
  );
}

function EditRow({
  category,
  onCancel,
  onSave,
}: {
  category: CategoryDTO;
  onCancel: () => void;
  onSave: (body: { name: string; image: string | null }) => void;
}) {
  const [name, setName] = useState(category.name);
  const [images, setImages] = useState(category.image ? [category.image] : []);
  return (
    <form
      className="grid gap-4 bg-brand-50/40 p-4 sm:grid-cols-[200px_1fr]"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ name, image: images[0] ?? null });
      }}
    >
      <ImageManager value={images} onChange={setImages} max={1} label="Photo" />
      <div className="space-y-3">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-stone-700">Name</span>
          <input className="input" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          <span className="block text-xs text-stone-500">Renaming moves all of its items along automatically.</span>
        </label>
        <div className="flex gap-2">
          <button className="btn-primary">Save</button>
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}

function NewCategory({ onCreate }: { onCreate: (body: { name: string; image: string | null }) => Promise<boolean> }) {
  const [name, setName] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    if (await onCreate({ name, image: images[0] ?? null })) {
      setName('');
      setImages([]);
    }
    setSaving(false);
  }

  return (
    <form onSubmit={submit} className="h-fit">
      <Panel title="Add a category" description="It appears on the website once it has at least one visible item.">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-stone-700">Name</span>
          <input className="input" required maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wraps" />
        </label>
        <ImageManager value={images} onChange={setImages} max={1} label="Photo" />
        <button className="btn-primary w-full" disabled={saving || !name.trim()}>
          {saving ? 'Adding…' : 'Add category'}
        </button>
      </Panel>
    </form>
  );
}
