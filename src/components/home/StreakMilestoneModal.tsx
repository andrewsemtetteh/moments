import { useEffect } from 'react';

import { StreakCelebration } from '@/components/home/StreakCelebration';
import { useStreak } from '@/hooks/queries';
import { markStreakMilestoneSeen } from '@/lib/streak-milestone-storage';
import { streakMilestoneHeadline, streakMilestoneStatusMessage } from '@/lib/streak-milestones';
import { useRelationshipStore, useUIStore } from '@/stores';

/**
 * Milestone celebrations (7, 15, 30, 50, 100… days): the same celebration as
 * every day, with the milestone's own headline. Shown once per milestone.
 */
export function StreakMilestoneModal() {
  const count = useUIStore((s) => s.streakMilestoneCount);
  const closeStreakMilestone = useUIStore((s) => s.closeStreakMilestone);
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const partner = useRelationshipStore((s) => s.partner);
  const { data: streak } = useStreak();
  const current = streak?.current_streak;

  // Only a real milestone counts as seen (not a preview from Settings).
  useEffect(() => {
    if (count && relationshipId && current === count) void markStreakMilestoneSeen(relationshipId, count);
  }, [count, relationshipId, current]);

  if (count == null || count <= 0) return null;

  return (
    <StreakCelebration
      key={count}
      count={count}
      fromCount={count - 1}
      headline={streakMilestoneHeadline(count)}
      message={`Milestone reached! ${streakMilestoneStatusMessage(partner?.name)}`}
      onClose={closeStreakMilestone}
    />
  );
}
