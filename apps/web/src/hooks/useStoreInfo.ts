'use client';

import { useEffect, useState } from 'react';
import type { StoreInfoDTO } from '@store/shared';
import { api } from '@/lib/api';

const REFRESH_MS = 60_000;

/**
 * Live opening status from the API, refreshed every minute while the page is
 * open so "Open now" flips at closing time without a reload. `initial` lets a
 * server-rendered page show its snapshot until the first refresh.
 */
export function useStoreInfo(initial: StoreInfoDTO | null = null): StoreInfoDTO | null {
  const [info, setInfo] = useState(initial);
  useEffect(() => {
    let alive = true;
    const load = () =>
      api<StoreInfoDTO>('/store', { cache: 'no-store' })
        .then((i) => alive && setInfo(i))
        .catch(() => undefined);
    void load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);
  return info;
}
