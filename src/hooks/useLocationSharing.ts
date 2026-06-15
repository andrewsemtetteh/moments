import { useCallback } from 'react';

import * as api from '@/services/api';
import { useAuthStore } from '@/stores';
import type { PlaceSnapshot } from '@/lib/location';

export function useLocationSharing() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  const enabled = user?.location_sharing_enabled ?? false;
  const loaded = user != null;

  const setSharingEnabled = useCallback(
    async (value: boolean, place?: PlaceSnapshot) => {
      if (!user) return;
      const updated = await api.updateLocationSharing(user.id, value, place);
      setUser({ ...user, ...updated });
    },
    [user, setUser],
  );

  return { enabled, setSharingEnabled, loaded };
}
