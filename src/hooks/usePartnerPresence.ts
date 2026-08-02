import { useEffect, useMemo, useRef, useState } from 'react';

import {
  setLocalOnlineStatusSharing,
  subscribePartnerPresence,
  type PartnerPresence,
} from '@/lib/partner-presence';
import { subscribePartnerLocation } from '@/lib/partner-location';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';

export type { PartnerPresence } from '@/lib/partner-presence';

export type PartnerPresenceView = PartnerPresence & {
  /**
   * Online/last-seen is hidden: you turned off sharing, and/or your partner did.
   * Reciprocal — if you hide yours, you don't see theirs either.
   */
  statusHidden: boolean;
};

export function usePartnerPresence(
  relationshipId: string | undefined,
  userId: string | undefined,
  partnerId: string | undefined,
): PartnerPresenceView {
  const shareMine = useAuthStore((s) => s.user?.show_online_status !== false);
  const partnerShares = useRelationshipStore((s) => s.partner?.show_online_status !== false);
  const partnerLastSeen = useRelationshipStore((s) => s.partner?.last_seen_at ?? null);
  const setPartner = useRelationshipStore((s) => s.setPartner);

  const [presence, setPresence] = useState<PartnerPresence>({
    isOnline: false,
    lastSeenAt: null,
  });
  const wasOnlineRef = useRef(false);

  useEffect(() => {
    if (!partnerId) return;
    void api.fetchPartnerProfile(partnerId).then((profile) => {
      if (profile) setPartner(profile);
    });
  }, [partnerId, setPartner]);

  // Keep show_online_status / last_seen_at in sync when partner toggles privacy.
  useEffect(() => {
    if (!partnerId) return;
    return subscribePartnerLocation(partnerId, () => {
      void api.fetchPartnerProfile(partnerId).then((profile) => {
        if (profile) setPartner(profile);
      });
    });
  }, [partnerId, setPartner]);

  useEffect(() => {
    if (!relationshipId || !userId || !partnerId) {
      setPresence({ isOnline: false, lastSeenAt: null });
      wasOnlineRef.current = false;
      return;
    }

    return subscribePartnerPresence(relationshipId, userId, partnerId, setPresence, {
      shareOnlineStatus: shareMine,
    });
  }, [relationshipId, userId, partnerId, shareMine]);

  useEffect(() => {
    if (!relationshipId) return;
    setLocalOnlineStatusSharing(relationshipId, shareMine);
  }, [relationshipId, shareMine]);

  // When partner drops offline, refresh their profile (show_online_status / last_seen_at).
  useEffect(() => {
    if (!partnerId) return;
    if (wasOnlineRef.current && !presence.isOnline) {
      void api.fetchPartnerProfile(partnerId).then((profile) => {
        if (profile) setPartner(profile);
      });
    }
    wasOnlineRef.current = presence.isOnline;
  }, [presence.isOnline, partnerId, setPartner]);

  return useMemo(() => {
    // Reciprocal privacy: hide theirs if you hide yours, or if they hide theirs.
    if (!shareMine || !partnerShares) {
      return { isOnline: false, lastSeenAt: null, statusHidden: true };
    }
    return {
      isOnline: presence.isOnline,
      lastSeenAt: presence.lastSeenAt ?? partnerLastSeen,
      statusHidden: false,
    };
  }, [shareMine, partnerShares, presence.isOnline, presence.lastSeenAt, partnerLastSeen]);
}
