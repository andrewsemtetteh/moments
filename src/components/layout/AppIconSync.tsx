import { useEffect } from 'react';

import { useSubscription } from '@/hooks/useSubscription';
import { currentAppIcon, setAppIcon } from '@/lib/app-icon';
import { isPlusNow } from '@/lib/plus';
import { useAuthStore, useRelationshipStore } from '@/stores';

/** How long Plus must still read as off before the icon goes back (the entitlement loads late on launch). */
const SETTLE_MS = 10_000;

/**
 * Custom app icons are a Moments Plus perk: when Plus ends, the Home Screen icon goes back to the
 * original. Waits for the account and the space to load, then re-checks after a pause, so a slow
 * start never takes a subscriber's icon away (iOS shows an alert every time the icon changes).
 */
export function AppIconSync() {
  const { isPlus } = useSubscription();
  const userId = useAuthStore((s) => s.user?.id);
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);

  useEffect(() => {
    if (isPlus || !userId || !relationshipId || currentAppIcon() === null) return;
    const timer = setTimeout(() => {
      if (isPlusNow() || currentAppIcon() === null) return;
      setAppIcon(null).catch(() => undefined);
    }, SETTLE_MS);
    return () => clearTimeout(timer);
  }, [isPlus, userId, relationshipId]);

  return null;
}
