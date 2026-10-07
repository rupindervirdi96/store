'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Role } from '@store/shared';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { useDemo } from '@/store/demo';

/** One-click sign-in with a published demo account. */
export function useDemoSignIn() {
  const router = useRouter();
  const login = useAuth((s) => s.login);
  const info = useDemo((s) => s.info);
  const setGuideOpen = useDemo((s) => s.setGuideOpen);
  const [busy, setBusy] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInAs(role: Role, next?: string) {
    const account = info?.accounts.find((a) => a.role === role);
    if (!account) return;
    setBusy(role);
    setError(null);
    try {
      await login(account.email, account.password);
      setGuideOpen(false);
      router.push(next ?? (role === 'admin' ? '/admin' : '/shop'));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not sign in');
    } finally {
      setBusy(null);
    }
  }

  return { signInAs, busy, error };
}
