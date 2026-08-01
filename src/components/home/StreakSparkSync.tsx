import { useEffect, useRef } from 'react';

import { useStreak } from '@/hooks/queries';
import { isStreakMilestone } from '@/lib/streak-milestones';
import { useRelationshipStore, useUIStore } from '@/stores';

const OPEN_DELAY_MS = 650;

/**
 * Opens the spark streak celebration whenever current_streak increases.
 * Skips milestone days (those use StreakMilestoneModal) and the first hydrate.
 */
export function StreakSparkSync() {
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const { data: streak } = useStreak();
  const openStreakSpark = useUIStore((s) => s.openStreakSpark);
  const streakSpark = useUIStore((s) => s.streakSpark);
  const streakMilestoneCount = useUIStore((s) => s.streakMilestoneCount);
  const showPaywall = useUIStore((s) => s.showPaywall);
  const prevCountRef = useRef<number | null>(null);
  const primedRef = useRef(false);

  useEffect(() => {
    prevCountRef.current = null;
    primedRef.current = false;
  }, [relationshipId]);

  useEffect(() => {
    if (!relationshipId || !streak) return;

    const count = streak.current_streak;

    // First load for this relationship — remember without celebrating.
    if (!primedRef.current) {
      primedRef.current = true;
      prevCountRef.current = count;
      return;
    }

    const prev = prevCountRef.current ?? 0;
    prevCountRef.current = count;

    if (count <= prev) return;
    if (showPaywall || streakSpark != null || streakMilestoneCount != null) return;
    // Milestone modal owns those celebrations.
    if (isStreakMilestone(count)) return;

    const fromCount = prev;
    const timer = setTimeout(() => {
      openStreakSpark(count, fromCount);
    }, OPEN_DELAY_MS);

    return () => clearTimeout(timer);
  }, [
    relationshipId,
    streak,
    openStreakSpark,
    streakSpark,
    streakMilestoneCount,
    showPaywall,
  ]);

  return null;
}
