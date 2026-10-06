export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
/** The web storefront, which hosts menu images referenced as "/images/...". */
export const ASSET_URL = process.env.EXPO_PUBLIC_ASSET_URL ?? 'http://localhost:3000';

/** Resolves a product image (absolute URL or site-relative path) to a loadable URI. */
export const imageUri = (src?: string) => (src && src.startsWith('/') ? `${ASSET_URL}${src}` : src);

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
  signal?: AbortSignal;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1${path}`, {
      method: opts.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...(opts.body !== undefined && { 'Content-Type': 'application/json' }),
        ...(opts.token && { Authorization: `Bearer ${opts.token}` }),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    });
  } catch {
    throw new ApiError(0, 'No connection. Check your network and try again.');
  }

  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? 'Request failed', data?.error?.details);
  return data as T;
}
