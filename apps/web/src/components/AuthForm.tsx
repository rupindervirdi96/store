'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';
import { DemoLoginHint } from './demo/DemoHints';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const params = useSearchParams();
  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Only allow same-site relative redirects.
  const nextParam = params.get('next');
  const next = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email'));
    const password = String(f.get('password'));
    try {
      const user =
        mode === 'login' ? await login(email, password) : await register(String(f.get('name')), email, password);
      router.replace(next ?? (user.role === 'admin' ? '/admin' : '/'));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  const other = mode === 'login' ? '/register' : '/login';
  const otherHref = next ? `${other}?next=${encodeURIComponent(next)}` : other;

  return (
    <div className="mx-auto max-w-sm space-y-4 py-12">
      <DemoLoginHint next={next} />
      <form onSubmit={onSubmit} className="card space-y-4 p-6">
        <h1 className="text-xl font-semibold">{mode === 'login' ? 'Sign in' : 'Create account'}</h1>
        {mode === 'register' && (
          <label className="block space-y-1 text-sm">
            <span className="text-stone-600">Name</span>
            <input name="name" required autoComplete="name" className="input" />
          </label>
        )}
        <label className="block space-y-1 text-sm">
          <span className="text-stone-600">Email</span>
          <input name="email" type="email" required autoComplete="email" className="input" />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-stone-600">Password</span>
          <input
            name="password"
            type="password"
            required
            minLength={mode === 'register' ? 8 : undefined}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            className="input"
          />
        </label>
        {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <button className="btn-primary w-full py-2.5" disabled={submitting}>
          {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
        </button>
        <p className="text-center text-sm text-stone-500">
          {mode === 'login' ? 'New here? ' : 'Already have an account? '}
          <Link href={otherHref} className="font-medium text-brand-700 hover:underline">
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </Link>
        </p>
      </form>
    </div>
  );
}
