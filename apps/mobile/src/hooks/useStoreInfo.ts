import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import type { StoreInfoDTO } from '@store/shared';
import { api } from '../lib/api';

const REFRESH_MS = 60_000;

/** Opening status from the API, refreshed on screen focus and every minute while focused. */
export function useStoreInfo(): StoreInfoDTO | null {
  const [info, setInfo] = useState<StoreInfoDTO | null>(null);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      const load = () =>
        api<StoreInfoDTO>('/store')
          .then((i) => alive && setInfo(i))
          .catch(() => undefined);
      void load();
      const id = setInterval(load, REFRESH_MS);
      return () => {
        alive = false;
        clearInterval(id);
      };
    }, []),
  );
  return info;
}
