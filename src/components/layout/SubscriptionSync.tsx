import { useEffect, useRef } from 'react';

import { backend } from '@/lib/backend';
import { initPurchases, usePurchasesStore } from '@/lib/purchases';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { Relationship } from '@/types/database';

/**
 * Keeps Moments Plus in sync for both partners:
 * - identifies the signed in user with Superwall (the paywall's prices and purchases need it),
 * - takes the couple's relationship row live from the server, so when either partner buys
 *   (the Superwall webhook writes Plus onto the relationship) the other unlocks straight away,
 * - refreshes it whenever this phone's own entitlement changes (bought, renewed, expired).
 */
export function SubscriptionSync() {
  const userId = useAuthStore((s) => s.user?.id);
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const entitlementActive = usePurchasesStore((s) => s.entitlement.active);
  const firstRun = useRef(true);

  useEffect(() => {
    void initPurchases(userId);
  }, [userId]);

  // Live relationship row (subscription columns included).
  useEffect(() => {
    if (!relationshipId) return;
    const channel = backend
      .channel(`relationship:${relationshipId}:relationships`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'relationships', filter: `id=eq.${relationshipId}` },
        (payload: { new?: Partial<Relationship> }) => {
          const next = payload?.new;
          const { relationship, setRelationship } = useRelationshipStore.getState();
          if (next && relationship && next.id === relationship.id) setRelationship({ ...relationship, ...next });
        },
      )
      .subscribe();
    return () => {
      void backend.removeChannel(channel);
    };
  }, [relationshipId]);

  // This phone bought / renewed / lost Plus: pull the couple's row (the webhook has updated it).
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!userId) return;
    const timer = setTimeout(() => {
      void api
        .fetchRelationship(userId)
        .then(({ relationship }) => {
          if (relationship) useRelationshipStore.getState().setRelationship(relationship);
        })
        .catch(() => undefined);
    }, 2500);
    return () => clearTimeout(timer);
  }, [entitlementActive, userId]);

  return null;
}
