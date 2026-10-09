import Link from 'next/link';
import {
  DEFAULT_STORE_HOURS,
  formatClosureDate,
  groupWeeklyHours,
  type CategoryDTO,
  type Paginated,
  type ProductDTO,
  type ReviewsDTO,
  type StoreInfoDTO,
} from '@store/shared';
import { ProductCard } from '@/components/ProductCard';
import { ReviewsSection } from '@/components/ReviewsSection';
import { SectionHeading } from '@/components/SectionHeading';
import { StarRating } from '@/components/StarRating';
import { StoreStatusBadge } from '@/components/StoreStatus';
import { directionsUrl, fullAddress, store, telHref } from '@/config/store';
import { tryApi } from '@/lib/api';

// Re-render at most once a minute; stock and offers stay fresh without
// hitting the API on every visit.
export const revalidate = 60;

const STEPS = [
  {
    title: 'Pick your favourites',
    body: 'Browse the menu and build your order in a few taps — your cart is saved even if you close the tab.',
    icon: 'M3 3h2l.4 2M7 13h10l4-8H5.4M7 13 5.4 5M7 13l-2.3 2.3c-.6.6-.2 1.7.7 1.7H17m0 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm-8 2a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z',
  },
  {
    title: 'Watch it happen live',
    body: 'See your order move from confirmed to on the grill to out for delivery — in real time, no refreshing.',
    icon: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  },
  {
    title: 'Dig in',
    body: 'Hot, fresh and exactly how you ordered it. Pickup or delivery straight to your door.',
    icon: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z',
  },
];

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} className="h-6 w-6" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
  );
}

export default async function HomePage() {
  const [offers, popular, categories, reviews, storeInfo] = await Promise.all([
    tryApi<Paginated<ProductDTO>>('/products?onSale=true&limit=4&sort=price_asc', { next: { revalidate: 60 } }),
    tryApi<Paginated<ProductDTO>>('/products?sort=popular&limit=8', { next: { revalidate: 60 } }),
    tryApi<CategoryDTO[]>('/categories', { next: { revalidate: 60 } }),
    tryApi<ReviewsDTO>('/reviews', { next: { revalidate: 3600 } }),
    tryApi<StoreInfoDTO>('/store', { next: { revalidate: 60 } }),
  ]);
  const schedule = groupWeeklyHours((storeInfo?.hours ?? DEFAULT_STORE_HOURS).weekly);
  const closures = storeInfo?.upcomingClosures.slice(0, 3) ?? [];

  const google = reviews?.configured ? reviews : null;
  // Already in the admin-defined order.
  const tiles = (categories ?? []).slice(0, 8);
  // "Popular" only means something once orders exist; before that it's just the menu.
  const hasSales = popular?.data.some((p) => p.soldCount > 0) ?? false;

  return (
    <main>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden bg-ink">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero.jpg"
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover opacity-70"
          fetchPriority="high"
        />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink via-ink/80 to-ink/10" />
        <div className="container-page flex min-h-[560px] flex-col justify-center py-20 sm:min-h-[640px]">
          <div className="max-w-xl space-y-6 text-white">
            <StoreStatusBadge initial={storeInfo} tone="dark" />
            <h1 className="text-5xl font-extrabold leading-[1.05] sm:text-6xl">
              Smashed fresh.
              <br />
              <span className="text-brand-400">Delivered hot.</span>
            </h1>
            <p className="text-lg text-stone-200">{store.description}</p>
            <div className="flex flex-wrap gap-3">
              <Link href="/shop" className="btn-primary px-7 py-3.5 text-base">
                Order now
              </Link>
              {offers && offers.data.length > 0 && (
                <a href="#offers" className="btn-ghost-light px-7 py-3.5 text-base">
                  Today&apos;s deals
                </a>
              )}
            </div>
            <div className="flex flex-wrap gap-x-8 gap-y-3 pt-4 text-sm">
              {google?.rating != null && (
                <div className="flex items-center gap-2">
                  <StarRating rating={google.rating} />
                  <span className="font-semibold">{google.rating.toFixed(1)}</span>
                  <span className="text-stone-300">on Google</span>
                </div>
              )}
              <div>
                <span className="block font-semibold">~{store.prepTime}</span>
                <span className="block text-stone-300">average prep time</span>
              </div>
              <div>
                <span className="block font-semibold">Live tracking</span>
                <span className="block text-stone-300">from grill to door</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Categories ───────────────────────────────────────── */}
      {tiles.length > 0 && (
        <section className="container-page -mt-12 relative z-10">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {tiles.map((c) => (
              <Link
                key={c.id}
                href={`/shop?category=${encodeURIComponent(c.name)}`}
                className="group relative flex aspect-[4/3] items-end overflow-hidden rounded-2xl bg-stone-800 shadow-lg"
              >
                {c.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-110"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/20 to-transparent" />
                <span className="relative flex w-full items-center justify-between p-4 font-display text-lg font-semibold capitalize text-white">
                  {c.name}
                  <span className="translate-x-0 transition group-hover:translate-x-1">→</span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Special offers ───────────────────────────────────── */}
      {offers && offers.data.length > 0 && (
        <section id="offers" className="container-page scroll-mt-20 py-20">
          <SectionHeading
            eyebrow="Special offers"
            title="Deals worth the drive"
            subtitle="Limited-time prices on some of our favourites. Grab them while they're hot."
            action={offers.total > offers.data.length ? { href: '/shop?onSale=true', label: 'See all deals' } : undefined}
          />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {offers.data.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* ── Most popular ─────────────────────────────────────── */}
      {popular && popular.data.length > 0 && (
        <section className="bg-white py-20">
          <div className="container-page">
            <SectionHeading
              eyebrow={hasSales ? 'Most popular' : 'Fan favourites'}
              title={hasSales ? 'What everyone is ordering' : 'Start with these'}
              subtitle={hasSales ? 'Our best sellers, ranked by what our customers order most.' : undefined}
              action={{ href: '/shop', label: 'Full menu' }}
            />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {popular.data.map((p, i) => (
                <ProductCard key={p.id} product={p} badge={hasSales && i < 3 && p.soldCount > 0 ? `#${i + 1} best seller` : undefined} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── How it works ─────────────────────────────────────── */}
      <section className="bg-ink py-20 text-white">
        <div className="container-page">
          <SectionHeading eyebrow="How it works" title="From our grill to your door" light />
          <div className="grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="mb-5 flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-white">
                    <Icon d={s.icon} />
                  </span>
                  <span className="font-display text-sm font-semibold text-stone-400">Step {i + 1}</span>
                </div>
                <h3 className="mb-2 text-xl font-semibold">{s.title}</h3>
                <p className="text-stone-300">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Reviews ──────────────────────────────────────────── */}
      <ReviewsSection data={reviews} />

      {/* ── Visit us ─────────────────────────────────────────── */}
      <section id="visit" className="container-page scroll-mt-20 py-20">
        <div className="grid overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-stone-200/80 lg:grid-cols-2">
          <div className="relative min-h-72">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/restaurant.jpg" alt={`Inside ${store.name}`} className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="space-y-8 p-8 sm:p-12">
            <div className="space-y-2">
              <p className="eyebrow">Visit us</p>
              <h2 className="text-3xl font-bold sm:text-4xl">Come hungry.</h2>
              <p className="text-stone-600">Dine in, take away, or order online for delivery.</p>
            </div>

            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-500">Opening hours</h3>
                <ul className="space-y-2 text-sm">
                  {schedule.map((h) => (
                    <li key={h.days}>
                      <span className="block font-medium">{h.days}</span>
                      <span className="text-stone-600">{h.time}</span>
                    </li>
                  ))}
                </ul>
                {closures.length > 0 && (
                  <ul className="mt-4 space-y-1 text-sm">
                    {closures.map((c) => (
                      <li key={c.date} className="text-rose-700">
                        <span className="font-medium">Closed {formatClosureDate(c.date)}</span>
                        {c.note && <span className="text-rose-600"> · {c.note}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-stone-500">Find us</h3>
                <address className="space-y-2 text-sm not-italic">
                  <p>{fullAddress}</p>
                  <p>
                    <a href={telHref} className="font-medium text-brand-700 hover:underline">
                      {store.phone}
                    </a>
                  </p>
                  <p>
                    <a href={`mailto:${store.email}`} className="font-medium text-brand-700 hover:underline">
                      {store.email}
                    </a>
                  </p>
                </address>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <a href={directionsUrl} target="_blank" rel="noreferrer" className="btn-primary">
                Get directions
              </a>
              <a href={telHref} className="btn-secondary">
                Call us
              </a>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
