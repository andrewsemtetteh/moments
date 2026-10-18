import { useEffect, useRef } from 'react';

import { useStreak } from '@/hooks/queries';
import { hasSeenStreakMilestone } from '@/lib/streak-milestone-storage';
import { isStreakMilestone } from '@/lib/streak-milestones';
import { isFullScreenLayerOpen, useRelationshipStore, useUIStore } from '@/stores';

const OPEN_DELAY_MS = 900;

/** Opens the streak milestone modal once per milestone per relationship. */
export function StreakMilestoneSync() {
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const { data: streak } = useStreak();
  const openStreakMilestone = useUIStore((s) => s.openStreakMilestone);
  // Waits for anything full-screen to close (e.g. the camera you just sent a moment from).
  const busy = useUIStore(isFullScreenLayerOpen);
  const lastCheckedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!relationshipId || !streak || streak.current_streak <= 0) return;
    if (busy) return;

    const count = streak.current_streak;
    if (!isStreakMilestone(count)) return;
    if (lastCheckedRef.current === count) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        if (cancelled) return;
        const seen = await hasSeenStreakMilestone(relationshipId, count);
        lastCheckedRef.current = count;
        if (cancelled || seen) return;
        openStreakMilestone(count);
      })();
    }, OPEN_DELAY_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    relationshipId,
    streak,
    openStreakMilestone,
    busy,
  ]);

  return null;
}
