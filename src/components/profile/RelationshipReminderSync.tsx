import { useEffect } from 'react';

import { getRelationshipAnniversaryIso } from '@/lib/anniversary';
import { getFirstName } from '@/lib/avatar-initial';
import { syncRelationshipReminders } from '@/lib/relationship-reminders';
import { useRelationshipStore } from '@/stores';

/**
 * Keeps the anniversary / milestone / Wrapped reminders scheduled on this
 * phone. Runs when you're paired and again whenever the anniversary date or
 * your partner changes. Renders nothing.
 */
export function RelationshipReminderSync() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const anniversaryIso =
    relationship?.created_at && relationship.status !== 'ended' ? getRelationshipAnniversaryIso(relationship) : null;
  const partnerName = getFirstName(partner?.name) ?? null;

  useEffect(() => {
    if (!anniversaryIso || !partnerName) return;
    void syncRelationshipReminders({ anniversaryIso, partnerName });
  }, [anniversaryIso, partnerName]);

  return null;
}
