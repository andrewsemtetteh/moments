import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

interface PresencePayload {
  user_id: string;
  online_at: string;
}

export interface PartnerPresence {
  isOnline: boolean;
  lastSeenAt: string | null;
}

function isPartnerPresent(state: Record<string, PresencePayload[]>, partnerId: string): boolean {
  return Object.values(state).some((presences) =>
    presences.some((presence) => presence.user_id === partnerId),
  );
}

export function usePartnerPresence(
  relationshipId: string | undefined,
  userId: string | undefined,
  partnerId: string | undefined,
): PartnerPresence {
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);

  useEffect(() => {
    if (!relationshipId || !userId || !partnerId) {
      setIsOnline(false);
      return;
    }

    const channel = supabase.channel(`presence:${relationshipId}`, {
      config: { presence: { key: userId } },
    });

    const syncPresence = () => {
      const state = channel.presenceState<PresencePayload>();
      setIsOnline(isPartnerPresent(state, partnerId));
    };

    channel
      .on('presence', { event: 'sync' }, syncPresence)
      .on('presence', { event: 'join' }, syncPresence)
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const partnerLeft = leftPresences.some((presence) => presence.user_id === partnerId);
        if (partnerLeft) {
          const seenAt = leftPresences.find((presence) => presence.user_id === partnerId)?.online_at;
          setLastSeenAt(seenAt ?? new Date().toISOString());
        }
        syncPresence();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user_id: userId, online_at: new Date().toISOString() });
        }
      });

    const heartbeat = setInterval(() => {
      void channel.track({ user_id: userId, online_at: new Date().toISOString() });
    }, 30_000);

    return () => {
      clearInterval(heartbeat);
      void channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [relationshipId, userId, partnerId]);

  return { isOnline, lastSeenAt };
}
