import { describe, expect, it } from 'vitest';

import { isStreakMilestone, streakMilestoneCheer, nextStreakMilestone, streakMilestoneName } from '@/lib/streak-milestones';

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

describe('nextStreakMilestone', () => {
  it('counts towards the same days the celebration fires on', () => {
    expect(nextStreakMilestone(0)).toBe(7);
    expect(nextStreakMilestone(7)).toBe(15);
    expect(nextStreakMilestone(10)).toBe(15);
    expect(nextStreakMilestone(499)).toBe(500);
    expect(nextStreakMilestone(500)).toBe(600);
    for (const n of [0, 7, 10, 60, 364, 650]) expect(isStreakMilestone(nextStreakMilestone(n))).toBe(true);
  });

  it('names them for the page', () => {
    expect(streakMilestoneName(15)).toBe('2 weeks');
    expect(streakMilestoneName(75)).toBe('75 days');
  });
});
