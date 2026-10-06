import type { ReviewsDTO } from '@store/shared';
import { SectionHeading } from './SectionHeading';
import { StarRating } from './StarRating';

function GoogleWordmark() {
  return (
    <span className="font-semibold tracking-tight" aria-label="Google">
      <span className="text-[#4285F4]">G</span>
      <span className="text-[#EA4335]">o</span>
      <span className="text-[#FBBC05]">o</span>
      <span className="text-[#4285F4]">g</span>
      <span className="text-[#34A853]">l</span>
      <span className="text-[#EA4335]">e</span>
    </span>
  );
}

/**
 * Real Google reviews only. When the Places API isn't configured the section
 * is hidden in production (and shows setup help in development) — we never
 * show made-up reviews.
 */
export function ReviewsSection({ data }: { data: ReviewsDTO | null }) {
  if (!data || !data.configured) {
    if (process.env.NODE_ENV === 'production') return null;
    return (
      <section className="container-page py-16">
        <div className="rounded-2xl border-2 border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          <p className="font-semibold text-stone-700">Google reviews will appear here</p>
          <p className="mt-1">
            Set <code>GOOGLE_PLACES_API_KEY</code> and <code>GOOGLE_PLACE_ID</code> on the API to enable this section.
            (This placeholder is only visible in development.)
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white py-20">
      <div className="container-page">
        <SectionHeading
          eyebrow="Customer love"
          title="What our guests are saying"
          action={data.mapsUri ? { href: data.mapsUri, label: 'All reviews on Google' } : undefined}
        />

        <div className="mb-10 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-2xl bg-cream p-5">
          {data.rating != null && (
            <div className="flex items-center gap-3">
              <span className="font-display text-4xl font-bold">{data.rating.toFixed(1)}</span>
              <div>
                <StarRating rating={data.rating} size={20} />
                <p className="text-sm text-stone-500">
                  {data.totalReviews.toLocaleString()} reviews on <GoogleWordmark />
                </p>
              </div>
            </div>
          )}
          <a href={data.writeReviewUri} target="_blank" rel="noreferrer" className="btn-secondary ml-auto">
            Write a review
          </a>
        </div>

        {data.reviews.length > 0 ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {data.reviews.map((r, i) => (
              <figure key={`${r.authorName}-${i}`} className="card flex flex-col gap-4 p-6">
                <div className="flex items-center justify-between">
                  <StarRating rating={r.rating} />
                  <span className="text-xs text-stone-400">{r.relativeTime}</span>
                </div>
                <blockquote className="line-clamp-6 flex-1 text-[15px] leading-relaxed text-stone-700">“{r.text}”</blockquote>
                <figcaption className="flex items-center gap-3">
                  {r.authorPhotoUri ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.authorPhotoUri} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700">
                      {r.authorName[0]}
                    </span>
                  )}
                  <div className="text-sm">
                    {r.authorUri ? (
                      <a href={r.authorUri} target="_blank" rel="noreferrer" className="font-semibold hover:underline">
                        {r.authorName}
                      </a>
                    ) : (
                      <span className="font-semibold">{r.authorName}</span>
                    )}
                    <p className="text-xs text-stone-400">
                      via <GoogleWordmark />
                    </p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : (
          <p className="text-stone-500">No written reviews yet — be the first!</p>
        )}
      </div>
    </section>
  );
}
