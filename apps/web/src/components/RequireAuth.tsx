'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import type { Role } from '@store/shared';
import { useHydrated } from '@/hooks/useHydrated';
import { useAuth } from '@/store/auth';

/**
 * Client-side route guard. This is a UX layer only — every protected API
 * endpoint independently enforces authentication and role checks.
 */
export function RequireAuth({ role, children }: { role?: Role; children: ReactNode }) {
  const hydrated = useHydrated();
  const user = useAuth((s) => s.user);
  const router = useRouter();
  const pathname = usePathname();

  const allowed = !!user && (!role || user.role === role);

  useEffect(() => {
    if (!hydrated) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (!allowed) router.replace('/');
  }, [hydrated, user, allowed, router, pathname]);

  if (!hydrated || !allowed) {
    return <div className="py-24 text-center text-sm text-stone-500">Loading…</div>;
  }
  return <>{children}</>;
}
