'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
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
  const [open, setOpen] = useState(false);

  // Close the phone menu on navigation and with Escape.
  useEffect(() => setOpen(false), [pathname]);
  // …and when tapping anywhere outside the header. (A fixed backdrop can't be
  // used here: the header's backdrop-blur makes it the containing block.)
  const headerRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open]);

  // Everything except the cart, for both the desktop bar and the phone menu.
  const links = [
    ...NAV,
    ...(hydrated && user ? [{ href: '/orders', label: 'My orders' }] : []),
    ...(hydrated && user?.role === 'admin' ? [{ href: '/admin', label: 'Admin', accent: true }] : []),
  ] as { href: string; label: string; accent?: boolean }[];

  const signOut = () => {
    setOpen(false);
    logout();
    router.push('/');
  };

  return (
    <header ref={headerRef} className="sticky top-0 z-30 border-b border-stone-200/70 bg-cream/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-3">
        <Logo />

        <nav className="hidden items-center gap-1 text-sm font-medium md:flex">
          {links.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-full px-4 py-2 transition ${
                n.accent ? 'text-brand-700 hover:bg-brand-50' : 'hover:bg-stone-200/60'
              } ${pathname === n.href ? 'text-brand-700' : n.accent ? '' : 'text-stone-700'}`}
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/cart"
            className="relative flex h-10 shrink-0 items-center gap-2 rounded-full border border-stone-300 bg-white px-3.5 text-sm font-semibold hover:border-stone-400 sm:px-4"
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

          {/* Desktop account controls */}
          {hydrated &&
            (user ? (
              <button
                className="hidden whitespace-nowrap rounded-full px-3 py-2 text-sm text-stone-600 hover:bg-stone-200/60 md:block"
                onClick={signOut}
              >
                Sign out
              </button>
            ) : (
              <Link href="/login" className="btn-primary hidden h-10 whitespace-nowrap md:inline-flex">
                Sign in
              </Link>
            ))}

          {/* Phone menu button */}
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden>
              {open ? (
                <path strokeLinecap="round" d="M6 6l12 12M18 6 6 18" />
              ) : (
                <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Phone menu panel */}
      {open && (
        <>
          <nav id="mobile-menu" className="border-t border-stone-200 bg-cream shadow-lg md:hidden">
            <ul className="container-page py-2">
              {links.map((n) => (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between rounded-xl px-3 py-3 text-base font-medium hover:bg-stone-200/60 ${
                      n.accent || pathname === n.href ? 'text-brand-700' : 'text-ink'
                    }`}
                  >
                    {n.label}
                    <span className="text-stone-400">›</span>
                  </Link>
                </li>
              ))}
              <li className="mt-2 border-t border-stone-200 pt-3 pb-1">
                {hydrated && user ? (
                  <div className="flex items-center justify-between gap-3 px-3">
                    <span className="truncate text-sm text-stone-500">{user.email}</span>
                    <button className="btn-secondary shrink-0" onClick={signOut}>
                      Sign out
                    </button>
                  </div>
                ) : (
                  <Link href="/login" onClick={() => setOpen(false)} className="btn-primary w-full">
                    Sign in
                  </Link>
                )}
              </li>
            </ul>
          </nav>
        </>
      )}
    </header>
  );
}
