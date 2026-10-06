import type { MediaUploadDTO } from '@store/shared';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  token?: string | null;
  /** Forwarded to fetch for server-component caching. */
  next?: { revalidate?: number | false; tags?: string[] };
  cache?: RequestCache;
}

/**
 * Thin typed fetch wrapper for the REST API. Works in server components
 * (pass no token) and client components (pass the token from useAuth).
 */
export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      ...(opts.body !== undefined && { 'Content-Type': 'application/json' }),
      ...(opts.token && { Authorization: `Bearer ${opts.token}` }),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    next: opts.next,
    cache: opts.cache,
  });

  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.message ?? res.statusText, data?.error?.details);
  }
  return data as T;
}

export const MAX_UPLOAD_MB = 10;

/** Uploads an image (admin only). The server resizes and converts it to WebP. */
export async function uploadImage(file: File, token: string | null): Promise<MediaUploadDTO> {
  const body = new FormData();
  body.append('file', file);
  const res = await fetch(`${API_URL}/api/v1/media`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? 'Upload failed');
  return data as MediaUploadDTO;
}

/** Tells the storefront to drop cached pages after an admin change. Best-effort. */
export function refreshStorefront(token: string | null): void {
  if (!token) return;
  void fetch('/api/revalidate', { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => undefined);
}

/**
 * For non-critical server-rendered sections: returns null instead of throwing,
 * so one failing request (or a cold-starting API during a build) can't take
 * down the whole page.
 */
export async function tryApi<T>(path: string, opts: RequestOptions = {}): Promise<T | null> {
  try {
    return await api<T>(path, opts);
  } catch (err) {
    console.error(`[api] ${path} failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}
