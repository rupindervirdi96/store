'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { OTP_LENGTH, type UserDTO, type VerificationSentResponse } from '@store/shared';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/store/auth';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const params = useSearchParams();
  const login = useAuth((s) => s.login);
  const register = useAuth((s) => s.register);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Set once sign-up details are accepted and a code has been emailed.
  const [pending, setPending] = useState<VerificationSentResponse | null>(null);

  // Only allow same-site relative redirects.
  const nextParam = params.get('next');
  const next = nextParam?.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;

  const onSignedIn = (user: UserDTO) => router.replace(next ?? (user.role === 'admin' ? '/admin' : '/'));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email')).trim();
    const password = String(f.get('password'));
    try {
      if (mode === 'login') onSignedIn(await login(email, password));
      else {
        setPending(await register(String(f.get('name')).trim(), email, password));
        setSubmitting(false);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  const other = mode === 'login' ? '/register' : '/login';
  const otherHref = next ? `${other}?next=${encodeURIComponent(next)}` : other;

  if (pending) {
    return (
      <div className="mx-auto max-w-sm py-12">
        <VerifyEmailForm sent={pending} onSent={setPending} onVerified={onSignedIn} onBack={() => setPending(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm py-12">
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
          {mode === 'register' && <span className="text-xs text-stone-500">At least 8 characters.</span>}
        </label>
        {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
        <button className="btn-primary w-full py-2.5" disabled={submitting}>
          {submitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Continue'}
        </button>
        {mode === 'register' && (
          <p className="text-center text-xs text-stone-500">We&apos;ll email you a code to confirm your address.</p>
        )}
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

/** Seconds until `iso`, ticking every second (0 once passed). */
function useSecondsUntil(iso: string): number {
  const [now, setNow] = useState(() => Date.now());
  const target = new Date(iso).getTime();
  useEffect(() => {
    if (target <= Date.now()) return;
    const id = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= target) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [target]);
  return Math.max(0, Math.ceil((target - now) / 1000));
}

function VerifyEmailForm({
  sent,
  onSent,
  onVerified,
  onBack,
}: {
  sent: VerificationSentResponse;
  onSent: (s: VerificationSentResponse) => void;
  onVerified: (user: UserDTO) => void;
  onBack: () => void;
}) {
  const verifyEmail = useAuth((s) => s.verifyEmail);
  const resendCode = useAuth((s) => s.resendCode);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const resendIn = useSecondsUntil(sent.resendAvailableAt);

  async function verify(value: string) {
    setError(null);
    setSubmitting(true);
    try {
      onVerified(await verifyEmail(sent.email, value));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  async function resend() {
    setError(null);
    setNotice(null);
    try {
      onSent(await resendCode(sent.email));
      setCode('');
      setNotice('A new code is on its way.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void verify(code);
      }}
      className="card space-y-4 p-6"
    >
      <h1 className="text-xl font-semibold">Check your email</h1>
      <p className="text-sm text-stone-600">
        We sent a {OTP_LENGTH}-digit code to <span className="font-medium text-stone-900">{sent.email}</span>. It
        expires in 10 minutes.
      </p>
      <input
        value={code}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, OTP_LENGTH);
          setCode(digits);
          // Submit as soon as the last digit is typed or pasted.
          if (digits.length === OTP_LENGTH && !submitting) void verify(digits);
        }}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        aria-label="Verification code"
        placeholder={'•'.repeat(OTP_LENGTH)}
        className="input text-center font-mono text-2xl tracking-[0.5em]"
      />
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      {notice && !error && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
      <button className="btn-primary w-full py-2.5" disabled={submitting || code.length !== OTP_LENGTH}>
        {submitting ? 'Verifying…' : 'Verify and create account'}
      </button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={onBack} className="text-stone-500 hover:underline">
          Use a different email
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={resendIn > 0}
          className="font-medium text-brand-700 hover:underline disabled:cursor-default disabled:text-stone-400 disabled:no-underline"
        >
          {resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'}
        </button>
      </div>
    </form>
  );
}
