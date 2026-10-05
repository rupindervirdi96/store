'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useHydrated } from '@/hooks/useHydrated';
import { useAuth } from '@/store/auth';
import { cartCount, useCart } from '@/store/cart';

export function Header() {
  const hydrated = useHydrated();
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const count = useCart((s) => cartCount(s.items));
  const router = useRouter();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Store<span className="text-brand-600">App</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm sm:gap-3">
          {hydrated && user?.role === 'admin' && (
            <Link href="/admin" className="rounded-lg px-3 py-2 font-medium text-brand-700 hover:bg-brand-50">
              Admin
            </Link>
          )}
          {hydrated && user && (
            <Link href="/orders" className="rounded-lg px-3 py-2 hover:bg-slate-100">
              Orders
            </Link>
          )}
          <Link href="/cart" className="relative rounded-lg px-3 py-2 hover:bg-slate-100">
            Cart
            {hydrated && count > 0 && (
              <span className="ml-1.5 rounded-full bg-brand-600 px-1.5 py-0.5 text-xs font-semibold text-white">
                {count}
              </span>
            )}
          </Link>
          {hydrated &&
            (user ? (
              <button
                className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  logout();
                  router.push('/');
                }}
              >
                Sign out
              </button>
            ) : (
              <Link href="/login" className="btn-primary">
                Sign in
              </Link>
            ))}
        </nav>
      </div>
    </header>
  );
}
