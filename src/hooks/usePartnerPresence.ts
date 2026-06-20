import { useEffect, useState } from 'react';

import { subscribePartnerPresence, type PartnerPresence } from '@/lib/partner-presence';

export type { PartnerPresence } from '@/lib/partner-presence';

export function usePartnerPresence(
  relationshipId: string | undefined,
  userId: string | undefined,
  partnerId: string | undefined,
): PartnerPresence {
  const [presence, setPresence] = useState<PartnerPresence>({
    isOnline: false,
    lastSeenAt: null,
  });

  useEffect(() => {
    if (!relationshipId || !userId || !partnerId) {
      setPresence({ isOnline: false, lastSeenAt: null });
      return;
    }

    return subscribePartnerPresence(relationshipId, userId, partnerId, setPresence);
  }, [relationshipId, userId, partnerId]);

  return presence;
}
