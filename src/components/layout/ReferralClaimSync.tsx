import { useAuth } from '@clerk/expo';
import { useEffect } from 'react';

import { claimReferral } from '@/lib/moments-api';
import { reportError } from '@/lib/monitoring';
import { clearPendingReferral, getPendingReferral } from '@/lib/pending-links';
import { useAuthStore } from '@/stores';

/**
 * A referral link opened before (or after) signing up is claimed here once
 * there's an account. One try per code: an invalid or own code is dropped.
 */
export function ReferralClaimSync() {
  const userId = useAuthStore((s) => s.user?.id);
  const { getToken } = useAuth();

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void (async () => {
      const code = await getPendingReferral();
      if (!code || cancelled) return;
      try {
        const token = await getToken();
        if (!token || cancelled) return;
        await claimReferral(token, code);
      } catch (e) {
        // Not valid or not eligible: nothing to retry.
        reportError(e, { where: 'claimReferral' });
      }
      await clearPendingReferral();
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, getToken]);

  return null;
}
