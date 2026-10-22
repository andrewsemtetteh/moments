import { usePurchasesStore } from '@/lib/purchases';
import { getEffectiveTier } from '@/lib/subscription';
import { useAuthStore, useRelationshipStore } from '@/stores';

/**
 * Plus right now, live: this phone's entitlement, or the couple's (either partner may pay). A light
 * version of `useSubscription` for things drawn many times, like the lock on each game card.
 */
export function useIsPlus(): boolean {
  const entitled = usePurchasesStore((s) => s.entitlement.active);
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  return entitled || getEffectiveTier(user, relationship) === 'plus';
}
