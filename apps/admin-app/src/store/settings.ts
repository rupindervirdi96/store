import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Per-device preferences for the restaurant tablet. */
interface SettingsState {
  /** Keep the screen on while the orders board is open. */
  keepAwake: boolean;
  /** Vibrate when a new paid order arrives. */
  vibrateOnNewOrder: boolean;
  set: (patch: Partial<Pick<SettingsState, 'keepAwake' | 'vibrateOnNewOrder'>>) => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      keepAwake: true,
      vibrateOnNewOrder: true,
      set: (patch) => set(patch),
    }),
    { name: 'store-admin-settings', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
