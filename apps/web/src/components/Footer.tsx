import Link from 'next/link';
import type { CategoryDTO } from '@store/shared';
import { tryApi } from '@/lib/api';
import { directionsUrl, fullAddress, store, telHref } from '@/config/store';
import { Logo } from './Logo';

export async function Footer() {
  const categories = await tryApi<CategoryDTO[]>('/categories', { next: { revalidate: 300 } });
  return (
    <footer className="mt-auto bg-ink text-stone-300">
      <div className="container-page grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <Logo light />
          <p className="text-sm leading-relaxed text-stone-400">{store.description}</p>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold text-white">Menu</h3>
          <ul className="space-y-2 text-sm">
            {(categories ?? []).map((c) => (
              <li key={c.id}>
                <Link href={`/shop?category=${encodeURIComponent(c.name)}`} className="capitalize hover:text-white">
                  {c.name}
                </Link>
              </li>
            ))}
            <li>
              <Link href="/shop?onSale=true" className="hover:text-white">
                Today&apos;s deals
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold text-white">Opening hours</h3>
          <ul className="space-y-2 text-sm">
            {store.hours.map((h) => (
              <li key={h.days}>
                <span className="block text-stone-400">{h.days}</span>
                {h.time}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-sm font-semibold text-white">Get in touch</h3>
          <ul className="space-y-2 text-sm">
            <li>
              <a href={directionsUrl} target="_blank" rel="noreferrer" className="hover:text-white">
                {fullAddress}
              </a>
            </li>
            <li>
              <a href={telHref} className="hover:text-white">
                {store.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${store.email}`} className="hover:text-white">
                {store.email}
              </a>
            </li>
          </ul>
          <div className="mt-5 flex gap-3">
            <a href={store.social.instagram} target="_blank" rel="noreferrer" className="rounded-full bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">
              Instagram
            </a>
            <a href={store.social.facebook} target="_blank" rel="noreferrer" className="rounded-full bg-white/10 px-3 py-1.5 text-xs hover:bg-white/20">
              Facebook
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container-page flex flex-col gap-2 py-6 text-xs text-stone-500 sm:flex-row sm:justify-between">
          <p>
            © {new Date().getFullYear()} {store.name}. All rights reserved.
          </p>
          <p>
            Food photography from{' '}
            <a href="https://unsplash.com" target="_blank" rel="noreferrer" className="underline hover:text-stone-300">
              Unsplash
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
