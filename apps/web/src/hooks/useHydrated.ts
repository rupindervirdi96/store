'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * False during SSR and the first client render, true afterwards. Use it to
 * gate UI that depends on localStorage-persisted stores (cart, auth) so the
 * server HTML and first client render match.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
