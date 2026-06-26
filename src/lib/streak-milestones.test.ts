import { describe, expect, it } from 'vitest';

import { isStreakMilestone, streakMilestoneCheer } from '@/lib/streak-milestones';

describe('isStreakMilestone', () => {
  it('includes core milestones', () => {
    expect(isStreakMilestone(7)).toBe(true);
    expect(isStreakMilestone(100)).toBe(true);
    expect(isStreakMilestone(365)).toBe(true);
    expect(isStreakMilestone(500)).toBe(true);
  });

  it('includes every 100 days after 500', () => {
    expect(isStreakMilestone(600)).toBe(true);
    expect(isStreakMilestone(1000)).toBe(true);
    expect(isStreakMilestone(550)).toBe(false);
  });

  it('excludes non-milestones', () => {
    expect(isStreakMilestone(6)).toBe(false);
    expect(isStreakMilestone(12)).toBe(false);
  });
});

describe('streakMilestoneCheer', () => {
  it('uses legendary copy for 100+', () => {
    expect(streakMilestoneCheer(100)).toContain('Legendary');
    expect(streakMilestoneCheer(365)).toContain('year');
  });
});
