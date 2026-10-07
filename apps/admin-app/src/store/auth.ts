import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { AuthResponse, UserDTO } from '@store/shared';
import { api, ApiError } from '../lib/api';
import { disconnectSocket } from '../lib/socket';

/** Keychain / Keystore on devices; localStorage when previewed in a browser. */
const storage: StateStorage =
  Platform.OS === 'web'
    ? {
        getItem: (k) => globalThis.localStorage?.getItem(k) ?? null,
        setItem: (k, v) => globalThis.localStorage?.setItem(k, v),
        removeItem: (k) => globalThis.localStorage?.removeItem(k),
      }
    : {
        getItem: (k) => SecureStore.getItemAsync(k),
        setItem: (k, v) => SecureStore.setItemAsync(k, v),
        removeItem: (k) => SecureStore.deleteItemAsync(k),
      };

interface AuthState {
  token: string | null;
  user: UserDTO | null;
  hydrated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      hydrated: false,
      async login(email, password) {
        const res = await api<AuthResponse>('/auth/login', { method: 'POST', body: { email, password } });
        // This app is for restaurant staff only.
        if (res.user.role !== 'admin') {
          throw new ApiError(403, 'This app is for restaurant staff. Please sign in with an admin account.');
        }
        set({ token: res.token, user: res.user });
      },
      logout() {
        disconnectSocket();
        set({ token: null, user: null });
      },
    }),
    {
      name: 'store-admin-auth',
      storage: createJSONStorage(() => storage),
      partialize: ({ token, user }) => ({ token, user }),
      // Deferred: with synchronous storage this runs before `useAuth` is assigned.
      onRehydrateStorage: () => () => queueMicrotask(() => useAuth.setState({ hydrated: true })),
    },
  ),
);
