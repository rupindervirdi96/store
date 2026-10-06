import type { GoogleReviewDTO, ReviewsDTO } from '@store/shared';
import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';

/**
 * Google reviews via the Places API (New) Place Details endpoint.
 *
 * Google returns at most 5 reviews (its "most relevant" selection) per place.
 * The API key never leaves the server. Results are cached in memory so page
 * traffic doesn't translate 1:1 into billable Places requests.
 *
 * Display requirements (Google Maps Platform terms): show the author name
 * with a link to their profile, and a Google attribution — the web
 * ReviewsSection component does both.
 */

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const FIELD_MASK = 'displayName,rating,userRatingCount,googleMapsUri,reviews';

let cache: { at: number; data: ReviewsDTO } | null = null;

interface PlacesReview {
  rating?: number;
  text?: { text?: string };
  originalText?: { text?: string };
  relativePublishTimeDescription?: string;
  publishTime?: string;
  authorAttribution?: { displayName?: string; uri?: string; photoUri?: string };
}

interface PlacesResponse {
  displayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: PlacesReview[];
}

async function fetchFromGoogle(apiKey: string, placeId: string): Promise<ReviewsDTO> {
  const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Places API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const place = (await res.json()) as PlacesResponse;

  const reviews: GoogleReviewDTO[] = (place.reviews ?? [])
    .filter((r) => (r.text?.text ?? r.originalText?.text)?.trim())
    .map((r) => ({
      authorName: r.authorAttribution?.displayName ?? 'Google user',
      authorUri: r.authorAttribution?.uri,
      authorPhotoUri: r.authorAttribution?.photoUri,
      rating: r.rating ?? 0,
      text: (r.text?.text ?? r.originalText?.text ?? '').trim(),
      relativeTime: r.relativePublishTimeDescription ?? '',
      publishTime: r.publishTime,
    }));

  return {
    configured: true,
    placeName: place.displayName?.text ?? '',
    rating: place.rating ?? null,
    totalReviews: place.userRatingCount ?? 0,
    mapsUri: place.googleMapsUri,
    writeReviewUri: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`,
    reviews,
  };
}

export async function getReviews(): Promise<ReviewsDTO> {
  const { GOOGLE_PLACES_API_KEY: apiKey, GOOGLE_PLACE_ID: placeId } = env;
  if (!apiKey || !placeId) return { configured: false };

  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.data;

  try {
    const data = await fetchFromGoogle(apiKey, placeId);
    cache = { at: Date.now(), data };
    return data;
  } catch (err) {
    console.error('[reviews] failed to fetch Google reviews', err);
    // Serve stale data rather than nothing if Google is briefly unavailable.
    if (cache) return cache.data;
    throw new AppError(502, 'Reviews are temporarily unavailable');
  }
}
