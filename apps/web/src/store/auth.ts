'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResponse, UserDTO } from '@store/shared';
import { api } from '@/lib/api';
import { disconnectSocket } from '@/lib/socket';

interface AuthState {
  token: string | null;
  user: UserDTO | null;
  login: (email: string, password: string) => Promise<UserDTO>;
  register: (name: string, email: string, password: string) => Promise<UserDTO>;
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
      async register(name, email, password) {
        const res = await api<AuthResponse>('/auth/register', {
          method: 'POST',
          body: { name, email, password },
        });
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
