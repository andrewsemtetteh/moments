import { useEffect, useRef } from 'react';

import { useStreak } from '@/hooks/queries';
import { hasSeenStreakMilestone } from '@/lib/streak-milestone-storage';
import { isStreakMilestone } from '@/lib/streak-milestones';
import { useRelationshipStore, useUIStore } from '@/stores';

const OPEN_DELAY_MS = 900;

/** Opens the streak milestone modal once per milestone per relationship. */
export function StreakMilestoneSync() {
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const { data: streak } = useStreak();
  const openStreakMilestone = useUIStore((s) => s.openStreakMilestone);
  const streakMilestoneCount = useUIStore((s) => s.streakMilestoneCount);
  const showPaywall = useUIStore((s) => s.showPaywall);
  const lastCheckedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!relationshipId || !streak || streak.current_streak <= 0) return;
    if (showPaywall || streakMilestoneCount != null) return;

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
    streakMilestoneCount,
    showPaywall,
  ]);

  return null;
}
