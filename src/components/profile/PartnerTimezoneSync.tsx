import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import * as api from '@/services/api';
import { useAuthStore } from '@/stores';

function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Keeps the user's IANA timezone in sync with the device so the partner header
 * can render a live local clock. Derived from the device locale, not GPS — no
 * permission prompt needed.
 */
export function PartnerTimezoneSync() {
  const userId = useAuthStore((s) => s.user?.id);
  const storedTimezone = useAuthStore((s) => s.user?.timezone);

  useEffect(() => {
    if (!userId) return;

    const sync = () => {
      const current = deviceTimezone();
      const latestUser = useAuthStore.getState().user;
      if (!latestUser || current === latestUser.timezone) return;
      void api
        .updateTimezone(userId, current)
        .then(() => {
          const stillCurrent = useAuthStore.getState().user;
          if (stillCurrent) useAuthStore.getState().setUser({ ...stillCurrent, timezone: current });
        })
        .catch(() => {
          // Best-effort background sync — safe to retry next time the app foregrounds.
        });
    };

    sync();

    const handler = (state: AppStateStatus) => {
      if (state === 'active') sync();
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [userId, storedTimezone]);

  return null;
}
