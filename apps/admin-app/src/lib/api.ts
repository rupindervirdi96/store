import { Platform } from 'react-native';
import type { MediaUploadDTO } from '@store/shared';

export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000';

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
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data?.error?.message ?? 'Request failed', data?.error?.details);
  return data as T;
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
    });
  } catch {
    throw new ApiError(0, 'No connection. Check the internet and try again.');
  }
  return parse<T>(res);
}

/** A photo picked from the camera or gallery. */
export interface LocalImage {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

/** Uploads a photo; the server resizes it and returns its URL. */
export async function uploadImage(image: LocalImage, token: string | null): Promise<MediaUploadDTO> {
  const body = new FormData();
  const name = image.fileName ?? `photo-${Date.now()}.jpg`;
  const type = image.mimeType ?? 'image/jpeg';
  if (Platform.OS === 'web') {
    // On web the picker gives a blob/data URI; turn it into a real file.
    body.append('file', new File([await (await fetch(image.uri)).blob()], name, { type }));
  } else {
    // React Native's FormData accepts { uri, name, type } for files.
    body.append('file', { uri: image.uri, name, type } as unknown as Blob);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/media`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body,
    });
  } catch {
    throw new ApiError(0, 'Upload failed — check the connection.');
  }
  return parse<MediaUploadDTO>(res);
}

/** Asks the website to show menu changes immediately (best-effort). */
export function refreshStorefront(token: string | null): void {
  if (!token) return;
  void fetch(`${WEB_URL}/api/revalidate`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(
    () => undefined,
  );
}
