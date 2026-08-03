import { describe, expect, it } from 'vitest';

import {
  isStreakVisuallyAtRisk,
  needsStreakReminders,
  shouldShowStreakAtRiskCard,
  streakReminderFireAt,
  STREAK_NUDGE_HOURS_BEFORE_MIDNIGHT,
  STREAK_WARN_HOURS_BEFORE_MIDNIGHT,
} from '@/lib/streak-reminder-timing';
import type { StreakStatus } from '@/types/database';

function baseStatus(overrides: Partial<StreakStatus> = {}): StreakStatus {
  return {
    relationship_id: 'rel',
    current_streak: 5,
    longest_streak: 10,
    last_active_date: '2026-08-02',
    at_risk: true,
    both_active_today: false,
    user_active_today: false,
    partner_active_today: false,
    can_restore_streak: false,
    restorable_streak: null,
    restorable_lost_at: null,
    ...overrides,
  };
}

describe('streak reminder timing', () => {
  it('uses 3 hour warn and 1 hour nudge', () => {
    expect(STREAK_WARN_HOURS_BEFORE_MIDNIGHT).toBe(3);
    expect(STREAK_NUDGE_HOURS_BEFORE_MIDNIGHT).toBe(1);
  });

  it('schedules fire times before midnight', () => {
    const now = new Date('2026-08-03T12:00:00');
    const warn = streakReminderFireAt(3, now);
    const nudge = streakReminderFireAt(1, now);
    expect(warn?.getHours()).toBe(21);
    expect(nudge?.getHours()).toBe(23);
  });

  it('returns null when the fire time already passed', () => {
    const now = new Date('2026-08-03T22:00:00');
    expect(streakReminderFireAt(3, now)).toBeNull();
    expect(streakReminderFireAt(1, now)?.getHours()).toBe(23);
  });
});

describe('isStreakVisuallyAtRisk', () => {
  it('hides danger until the last 3 hours', () => {
    const status = baseStatus();
    expect(isStreakVisuallyAtRisk(status, new Date('2026-08-03T18:00:00'))).toBe(false);
    expect(shouldShowStreakAtRiskCard(status, new Date('2026-08-03T21:00:00'))).toBe(true);
    expect(isStreakVisuallyAtRisk(status, new Date('2026-08-03T23:30:00'))).toBe(true);
  });
});

describe('needsStreakReminders', () => {
  it('only reminds when this user still needs to check in', () => {
    expect(needsStreakReminders(baseStatus())).toBe(true);
    expect(needsStreakReminders(baseStatus({ user_active_today: true }))).toBe(false);
    expect(needsStreakReminders(baseStatus({ at_risk: false }))).toBe(false);
  });
});
