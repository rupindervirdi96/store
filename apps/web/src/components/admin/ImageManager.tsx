'use client';

import { useRef, useState, type DragEvent } from 'react';
import { MAX_UPLOAD_MB, uploadImage } from '@/lib/api';
import { useAuth } from '@/store/auth';

interface Pending {
  key: string;
  preview: string;
  name: string;
}

/**
 * Upload, reorder and remove photos. The first photo is the cover shown on
 * menu cards. Uploads start immediately; the parent saves the resulting URLs.
 */
export function ImageManager({
  value,
  onChange,
  max = 8,
  label = 'Photos',
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  label?: string;
}) {
  const token = useAuth((s) => s.token);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  // Keep a live copy so concurrent uploads append to the latest list.
  const latest = useRef(value);
  latest.current = value;

  const slotsLeft = max - value.length - pending.length;
  const single = max === 1;

  async function addFiles(files: FileList | File[]) {
    setErrors([]);
    const list = Array.from(files);
    const problems: string[] = [];
    const accepted = list.filter((f) => {
      if (!f.type.startsWith('image/')) {
        problems.push(`${f.name}: not an image`);
        return false;
      }
      if (f.size > MAX_UPLOAD_MB * 1024 * 1024) {
        problems.push(`${f.name}: larger than ${MAX_UPLOAD_MB} MB`);
        return false;
      }
      return true;
    });
    // In single-image mode a new upload replaces the current one.
    const room = single ? 1 : Math.max(0, slotsLeft);
    if (accepted.length > room) problems.push(`Only ${max} photo${max === 1 ? '' : 's'} allowed`);
    const batch = accepted.slice(0, room);
    setErrors(problems);
    if (batch.length === 0) return;

    const items = batch.map((f) => ({ file: f, key: `${f.name}-${f.size}-${Math.random()}`, preview: URL.createObjectURL(f) }));
    setPending((p) => [...p, ...items.map(({ key, preview, file }) => ({ key, preview, name: file.name }))]);

    await Promise.all(
      items.map(async ({ file, key, preview }) => {
        try {
          const { url } = await uploadImage(file, token);
          onChange(single ? [url] : [...latest.current, url]);
          latest.current = single ? [url] : [...latest.current, url];
        } catch (err) {
          setErrors((e) => [...e, `${file.name}: ${err instanceof Error ? err.message : 'upload failed'}`]);
        } finally {
          setPending((p) => p.filter((x) => x.key !== key));
          URL.revokeObjectURL(preview);
        }
      }),
    );
  }

  const move = (from: number, to: number) => {
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) void addFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-stone-700">{label}</span>
        {!single && (
          <span className="text-xs text-stone-500">
            {value.length}/{max} · first photo is the cover
          </span>
        )}
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`grid gap-3 rounded-2xl transition ${single ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'} ${
          dragging ? 'bg-brand-50 ring-2 ring-brand-400 ring-offset-4' : ''
        }`}
      >
        {value.map((url, i) => (
          <figure key={url} className="group relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100 ring-1 ring-stone-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            {i === 0 && !single && (
              <span className="absolute left-2 top-2 rounded-full bg-ink/80 px-2 py-0.5 text-[11px] font-semibold text-white">
                Cover
              </span>
            )}
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-ink/80 to-transparent p-2 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
              <div className="flex gap-1">
                {!single && i > 0 && (
                  <button type="button" onClick={() => move(i, i - 1)} className="rounded-md bg-white/90 px-2 py-1 text-xs font-medium" aria-label="Move left">
                    ←
                  </button>
                )}
                {!single && i < value.length - 1 && (
                  <button type="button" onClick={() => move(i, i + 1)} className="rounded-md bg-white/90 px-2 py-1 text-xs font-medium" aria-label="Move right">
                    →
                  </button>
                )}
                {!single && i > 0 && (
                  <button type="button" onClick={() => move(i, 0)} className="rounded-md bg-white/90 px-2 py-1 text-xs font-medium">
                    Make cover
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white"
              >
                Remove
              </button>
            </div>
          </figure>
        ))}

        {pending.map((p) => (
          <div key={p.key} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.preview} alt="" className="h-full w-full object-cover opacity-50" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs font-medium text-stone-700">
              <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
              Uploading…
            </div>
          </div>
        ))}

        {(single ? pending.length === 0 && value.length === 0 : slotsLeft > 0) && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-[4/3] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-stone-300 bg-white text-sm text-stone-500 transition hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
          >
            <span className="text-2xl leading-none">＋</span>
            <span className="font-medium">{single ? 'Upload photo' : 'Add photos'}</span>
            <span className="text-xs">or drag &amp; drop</span>
          </button>
        )}
      </div>

      {single && value.length > 0 && (
        <button type="button" onClick={() => inputRef.current?.click()} className="text-sm font-medium text-brand-700 hover:underline">
          Replace photo
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={!single}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
          e.target.value = '';
        }}
      />

      {errors.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-stone-500">JPEG, PNG, WebP or HEIC up to {MAX_UPLOAD_MB} MB. Photos are resized automatically.</p>
    </div>
  );
}
