import { usePartnerPresence } from '@/hooks/usePartnerPresence';
import { useAuthStore, useRelationshipStore } from '@/stores';

/**
 * Keeps presence broadcasting / listening alive while the app is open,
 * not only when Chat is mounted — so "Show online status" works from Profile.
 */
export function PartnerPresenceSync() {
  const userId = useAuthStore((s) => s.user?.id);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partnerId = useRelationshipStore((s) => s.partner?.id);

  const active =
    relationship && relationship.status !== 'ended' ? relationship.id : undefined;

  usePartnerPresence(active, userId, partnerId);
  return null;
}
