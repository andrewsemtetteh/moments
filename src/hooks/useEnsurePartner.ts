import { useEffect } from 'react';

import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';

/** Keeps relationship + partner profile in sync with the server (fixes stale member ids after join). */
export function useEnsurePartner() {
  const user = useAuthStore((s) => s.user);
  const setRelationship = useRelationshipStore((s) => s.setRelationship);
  const setPartner = useRelationshipStore((s) => s.setPartner);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    void api.fetchRelationship(user.id).then(({ relationship, partner }) => {
      if (cancelled) return;
      if (relationship) setRelationship(relationship);
      if (partner) setPartner(partner);
    });

    return () => {
      cancelled = true;
    };
  }, [user?.id, setRelationship, setPartner]);
}
