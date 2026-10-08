'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResponse, UserDTO, VerificationSentResponse } from '@store/shared';
import { api } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';

interface AuthState {
  token: string | null;
  user: UserDTO | null;
  login: (email: string, password: string) => Promise<UserDTO>;
  /** Emails a verification code; the account is created by verifyEmail. */
  register: (name: string, email: string, password: string) => Promise<VerificationSentResponse>;
  resendCode: (email: string) => Promise<VerificationSentResponse>;
  verifyEmail: (email: string, code: string) => Promise<UserDTO>;
  logout: () => void;
}

/*
 * The JWT is kept in localStorage so the browser can call the API and open a
 * socket on a different origin (Render). If web and API share a parent domain,
 * prefer an httpOnly cookie to shrink the XSS blast radius.
 */
export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      async login(email, password) {
        const res = await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } });
        set({ token: res.token, user: res.user });
        return res.user;
      },
      register(name, email, password) {
        return api<VerificationSentResponse>('/auth/register', { method: 'POST', body: { name, email, password } });
      },
      resendCode(email) {
        return api<VerificationSentResponse>('/auth/register/resend', { method: 'POST', body: { email } });
      },
      async verifyEmail(email, code) {
        const res = await api<AuthResponse>('/auth/register/verify', { method: 'POST', body: { email, code } });
        set({ token: res.token, user: res.user });
        return res.user;
      },
      logout() {
        disconnectSocket();
        set({ token: null, user: null });
      },
    }),
    { name: 'store-auth' },
  ),
);
