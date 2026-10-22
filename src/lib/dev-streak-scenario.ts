import { addDays, format } from 'date-fns';

import type { StreakStatus } from '@/types/database';

export type DevStreakScenario = 'at_risk' | 'restore' | 'frozen';

const day = (d: Date) => format(d, 'yyyy-MM-dd');

/**
 * Settings › Developer: your real streak, made to look at risk (checked in up to
 * yesterday, not yet today) or just lost with a restore available, so Home's alerts and
 * restore banner can be seen any time. Never sent to the server.
 */
export function applyStreakScenario(status: StreakStatus, scenario: DevStreakScenario, now = new Date()): StreakStatus {
  const count = Math.max(status.current_streak, status.restorable_streak ?? 0, 12);
  if (scenario === 'frozen') {
    // Missed yesterday, and a freeze kept the streak: yesterday frozen, today still to do.
    return {
      ...status,
      current_streak: count,
      longest_streak: Math.max(status.longest_streak, count),
      last_active_date: day(addDays(now, -1)),
      at_risk: true,
      user_active_today: false,
      both_active_today: false,
      can_restore_streak: false,
      restorable_streak: null,
      restorable_lost_at: null,
      active_days: Array.from({ length: count }, (_, i) => day(addDays(now, -(i + 2)))),
      frozen_days: [day(addDays(now, -1))],
      streak_freezes: 1,
    };
  }
  if (scenario === 'at_risk') {
    const days = Array.from({ length: count }, (_, i) => day(addDays(now, -(i + 1))));
    return {
      ...status,
      current_streak: count,
      longest_streak: Math.max(status.longest_streak, count),
      last_active_date: day(addDays(now, -1)),
      at_risk: true,
      user_active_today: false,
      both_active_today: false,
      can_restore_streak: false,
      restorable_streak: null,
      restorable_lost_at: null,
      active_days: days,
    };
  }
  return {
    ...status,
    current_streak: 0,
    longest_streak: Math.max(status.longest_streak, count),
    last_active_date: day(addDays(now, -2)),
    at_risk: false,
    user_active_today: false,
    both_active_today: false,
    can_restore_streak: true,
    restorable_streak: count,
    // Lost two hours ago: well inside the 24-hour restore window.
    restorable_lost_at: new Date(now.getTime() - 2 * 3600_000).toISOString(),
    active_days: Array.from({ length: count }, (_, i) => day(addDays(now, -(i + 2)))),
  };
}
