'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useHydrated } from '@/hooks/useHydrated';
import { useAuth } from '@/store/auth';
import { cartCount, useCart } from '@/store/cart';
import { Logo } from './Logo';

const NAV = [
  { href: '/shop', label: 'Menu' },
  { href: '/shop?onSale=true', label: 'Deals' },
  { href: '/#visit', label: 'Visit us' },
];

export function Header() {
  const hydrated = useHydrated();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const count = useCart((s) => cartCount(s.items));
  const router = useRouter();
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200/70 bg-cream/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Logo />

        <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-full px-4 py-2 transition hover:bg-stone-200/60 ${
                pathname === n.href ? 'text-brand-700' : 'text-stone-700'
              }`}
            >
              {n.label}
            </Link>
          ))}
          {hydrated && user && (
            <Link href="/orders" className="rounded-full px-4 py-2 text-stone-700 hover:bg-stone-200/60">
              My orders
            </Link>
          )}
          {hydrated && user?.role === 'admin' && (
            <Link href="/admin" className="rounded-full px-4 py-2 text-brand-700 hover:bg-brand-50">
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/shop"
            className="rounded-full px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-200/60 md:hidden"
          >
            Menu
          </Link>
          <Link
            href="/cart"
            className="relative flex h-10 items-center gap-2 rounded-full border border-stone-300 bg-white px-4 text-sm font-semibold hover:border-stone-400"
            aria-label={`Cart${hydrated && count ? `, ${count} items` : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2M10 21h.01M17 21h.01" />
            </svg>
            <span className="hidden sm:inline">Cart</span>
            {hydrated && count > 0 && (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-bold text-white">{count}</span>
            )}
          </Link>
          {hydrated &&
            (user ? (
              <button
                className="hidden rounded-full px-3 py-2 text-sm text-stone-600 hover:bg-stone-200/60 sm:block"
                onClick={() => {
                  logout();
                  router.push('/');
                }}
              >
                Sign out
              </button>
            ) : (
              <Link href="/login" className="btn-primary h-10">
                Sign in
              </Link>
            ))}
        </div>
      </div>
    </header>
  );
}
