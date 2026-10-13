import { useEffect } from 'react';

import { useStreak } from '@/hooks/queries';
import { getLastCelebratedStreak, setLastCelebratedStreak } from '@/lib/streak-celebration-storage';
import { isStreakMilestone } from '@/lib/streak-milestones';
import { useRelationshipStore, useUIStore } from '@/stores';

const OPEN_DELAY_MS = 650;

/**
 * Opens the streak celebration whenever the streak has gone up since the
 * last one we celebrated on this phone, including when it went up while the
 * app was closed (your partner finished the day after you left). It waits,
 * rather than skipping, while the paywall or another celebration is open.
 * Milestone days are left to StreakMilestoneModal. The very first time on
 * a phone just records the count, without celebrating.
 */
export function StreakSparkSync() {
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const { data: streak } = useStreak();
  const openStreakSpark = useUIStore((s) => s.openStreakSpark);
  const busy = useUIStore((s) => s.showPaywall || s.streakSpark != null || s.streakMilestoneCount != null);
  const count = streak?.current_streak;

  useEffect(() => {
    if (!relationshipId || count == null) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void (async () => {
      const last = await getLastCelebratedStreak(relationshipId);
      if (cancelled) return;
      // First time on this phone (or for this couple): just remember it.
      if (last == null) {
        await setLastCelebratedStreak(relationshipId, count);
        return;
      }
      // Same, or the streak ended and restarted lower: remember, no party.
      if (count <= last) {
        if (count < last) await setLastCelebratedStreak(relationshipId, count);
        return;
      }
      // Something else is on screen: try again when it closes (this effect re-runs).
      if (busy) return;
      // Milestones have their own celebration.
      if (isStreakMilestone(count)) {
        await setLastCelebratedStreak(relationshipId, count);
        return;
      }
      timer = setTimeout(() => {
        if (cancelled) return;
        void setLastCelebratedStreak(relationshipId, count);
        openStreakSpark(count, last);
      }, OPEN_DELAY_MS);
    })();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [relationshipId, count, busy, openStreakSpark]);

  return null;
}
