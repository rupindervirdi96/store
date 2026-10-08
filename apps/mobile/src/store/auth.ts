import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { AuthResponse, UserDTO, VerificationSentResponse } from '@store/shared';
import { api } from '../lib/api';
import { disconnectSocket } from '../lib/socket';

/** Keychain (iOS) / Keystore-encrypted prefs (Android) for the JWT. */
const secureStorage: StateStorage = {
  getItem: (k) => SecureStore.getItemAsync(k),
  setItem: (k, v) => SecureStore.setItemAsync(k, v),
  removeItem: (k) => SecureStore.deleteItemAsync(k),
};

interface AuthState {
  token: string | null;
  user: UserDTO | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Emails a verification code; the account is created by verifyEmail. */
  register: (name: string, email: string, password: string) => Promise<VerificationSentResponse>;
  resendCode: (email: string) => Promise<VerificationSentResponse>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  logout: () => void;
  setUser: (user: UserDTO) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hydrated: false,
      async login(email, password) {
        const res = await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } });
        set({ token: res.token, user: res.user });
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
      },
      logout() {
        disconnectSocket();
        set({ token: null, user: null });
      },
      setUser: (user) => set({ user }),
    }),
    {
      name: 'store-auth',
      storage: createJSONStorage(() => secureStorage),
      partialize: ({ token, user }) => ({ token, user }),
      // Deferred: with synchronous storage this runs before `useAuth` is assigned.
      onRehydrateStorage: () => () => queueMicrotask(() => useAuth.setState({ hydrated: true })),
    },
  ),
);
