import { Types } from 'mongoose';
import sharp, { type Metadata } from 'sharp';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { MediaModel } from './media.model';

/**
 * Image references stored on products/categories/orders are one of:
 *   "media:<objectId>"  an upload stored in MongoDB (served by GET /api/v1/media/:id)
 *   "https://…"         an external image URL
 *   "/images/…"         a legacy path to an asset bundled with the web app
 *
 * Storing a reference (not a full URL) keeps the database independent of the
 * API's hostname; DTOs turn references into absolute URLs on the way out.
 */
const MEDIA_PREFIX = 'media:';
const MEDIA_URL_RE = /\/api\/v1\/media\/([a-f0-9]{24})(?:[?#].*)?$/i;

const MAX_DIMENSION = 1600;
const MAX_INPUT_PIXELS = 50_000_000; // guards against decompression bombs

export const mediaUrl = (id: string) => `${env.PUBLIC_URL}/api/v1/media/${id}`;

/** Reference → URL for API responses. */
export function resolveImage(ref: string): string;
export function resolveImage(ref: string | null | undefined): string | undefined;
export function resolveImage(ref: string | null | undefined): string | undefined {
  if (!ref) return undefined;
  return ref.startsWith(MEDIA_PREFIX) ? mediaUrl(ref.slice(MEDIA_PREFIX.length)) : ref;
}

/** URL (as clients echo it back) → reference for storage. Works for any API host. */
export function normalizeImageRef(value: string): string {
  const match = MEDIA_URL_RE.exec(value);
  return match ? `${MEDIA_PREFIX}${match[1].toLowerCase()}` : value;
}

export const mediaIdOf = (ref: string) => (ref.startsWith(MEDIA_PREFIX) ? ref.slice(MEDIA_PREFIX.length) : null);

/**
 * Validates, auto-rotates, resizes and re-encodes an upload to WebP.
 * Any non-image (or SVG, which could carry script) is rejected.
 */
export async function storeImage(
  file: { buffer: Buffer; originalname?: string },
  uploadedBy?: string,
): Promise<{ id: string; ref: string; url: string; width: number; height: number; size: number }> {
  let meta: Metadata;
  try {
    meta = await sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw AppError.badRequest('That file is not a supported image');
  }
  if (!meta.format || !['jpeg', 'png', 'webp', 'avif', 'heif', 'gif', 'tiff'].includes(meta.format)) {
    throw AppError.badRequest('Please upload a JPEG, PNG, WebP, AVIF or HEIC image');
  }

  const { data, info } = await sharp(file.buffer, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate() // honour EXIF orientation from phone cameras, then strip metadata
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });

  const doc = await MediaModel.create({
    data,
    contentType: 'image/webp',
    size: info.size,
    width: info.width,
    height: info.height,
    originalName: file.originalname?.slice(0, 255),
    uploadedBy,
  });

  return { id: doc.id, ref: `${MEDIA_PREFIX}${doc.id}`, url: mediaUrl(doc.id), width: info.width, height: info.height, size: info.size };
}

export async function getImage(id: string) {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound('Image not found');
  const doc = await MediaModel.findById(id).lean();
  if (!doc) throw AppError.notFound('Image not found');
  // lean() yields the driver's Binary type; convert to a real Buffer, or
  // Express would serialise it as JSON instead of sending the bytes.
  const raw = doc.data as unknown as { buffer: ArrayBufferLike | Uint8Array } | Buffer;
  const data = Buffer.isBuffer(raw) ? raw : Buffer.from(raw.buffer as Uint8Array);
  return { contentType: doc.contentType, data };
}

/**
 * Deletes uploads that are no longer referenced anywhere. Order snapshots
 * count as references so past orders keep their pictures.
 */
export async function deleteIfUnreferenced(refs: string[]): Promise<number> {
  const ids = [...new Set(refs.map(mediaIdOf).filter((x): x is string => !!x))];
  if (ids.length === 0) return 0;

  // Imported lazily to avoid a circular import (those models' DTOs use resolveImage).
  const { ProductModel } = await import('../products/product.model');
  const { CategoryModel } = await import('../categories/category.model');
  const { OrderModel } = await import('../orders/order.model');

  let deleted = 0;
  for (const id of ids) {
    const ref = `${MEDIA_PREFIX}${id}`;
    const [p, c, o] = await Promise.all([
      ProductModel.exists({ images: ref }),
      CategoryModel.exists({ image: ref }),
      OrderModel.exists({ 'items.image': ref }),
    ]);
    if (!p && !c && !o) {
      await MediaModel.deleteOne({ _id: id });
      deleted++;
    }
  }
  return deleted;
}
