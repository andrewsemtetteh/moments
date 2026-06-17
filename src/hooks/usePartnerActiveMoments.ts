import { useMemo } from 'react';

import { useMoments } from '@/hooks/queries';
import {
  enrichMomentsWithAuthors,
  getPartnerActiveMoments,
} from '@/lib/moment-display';
import { withHomePartnerMoments } from '@/lib/mock-moments';
import { useAuthStore, useRelationshipStore } from '@/stores';

export function usePartnerActiveMoments() {
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const relationship = useRelationshipStore((s) => s.relationship);
  const { data: momentsData } = useMoments();

  const partnerId = useMemo(() => {
    if (partner?.id) return partner.id;
    if (!relationship || !user) return null;
    return relationship.user_1_id === user.id ? relationship.user_2_id : relationship.user_1_id;
  }, [partner?.id, relationship, user]);

  return useMemo(() => {
    const flat = momentsData?.pages.flat() ?? [];
    const enriched = enrichMomentsWithAuthors(flat, user, partner);
    const active = getPartnerActiveMoments(enriched, user?.id, partnerId);

    if (active.length > 0) return active;

    if (relationship?.id && user?.id) {
      const homeMocked = withHomePartnerMoments(
        active,
        {
          relationshipId: relationship.id,
          userId: user.id,
          partnerId,
          partnerName: partner?.name,
        },
        user.id,
      );
      if (homeMocked.length > 0) return homeMocked;
    }

    return active;
  }, [momentsData, user, partner, partnerId, relationship?.id]);
}
