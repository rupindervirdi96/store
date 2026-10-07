'use client';

import { create } from 'zustand';
import type { DemoInfoDTO } from '@store/shared';
import { API_URL } from '@/lib/api';

/**
 * Demo details come from the API (GET /demo exists only when the API runs with
 * DEMO_MODE=true), so the demo UI follows the backend's switch automatically.
 */
interface DemoState {
  info: DemoInfoDTO | null;
  guideOpen: boolean;
  load: () => Promise<void>;
  setGuideOpen: (open: boolean) => void;
}

let loading: Promise<void> | null = null;

export const useDemo = create<DemoState>()((set) => ({
  info: null,
  guideOpen: false,
  load: () =>
    (loading ??= fetch(`${API_URL}/api/v1/demo`)
      .then((r) => (r.ok ? (r.json() as Promise<DemoInfoDTO>) : null))
      .then((info) => set({ info: info?.enabled ? info : null }))
      .catch(() => set({ info: null }))),
  setGuideOpen: (guideOpen) => set({ guideOpen }),
}));
