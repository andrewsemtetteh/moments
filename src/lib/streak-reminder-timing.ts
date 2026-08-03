import type { StreakStatus } from '@/types/database';

/** In-app danger UI + first local warning. */
export const STREAK_WARN_HOURS_BEFORE_MIDNIGHT = 3;
/** Final local nudge / push-style alert. */
export const STREAK_NUDGE_HOURS_BEFORE_MIDNIGHT = 1;

export function msUntilLocalMidnight(now = new Date()): number {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.max(0, midnight.getTime() - now.getTime());
}

export function localMidnight(now = new Date()): Date {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight;
}

/** Fire time for a reminder N hours before local midnight, or null if already passed. */
export function streakReminderFireAt(
  hoursBeforeMidnight: number,
  now = new Date(),
): Date | null {
  const fire = new Date(localMidnight(now).getTime() - hoursBeforeMidnight * 60 * 60 * 1000);
  if (fire.getTime() <= now.getTime()) return null;
  return fire;
}

/**
 * Danger styling / at-risk card only in the last N hours before midnight,
 * even if the server already marks the streak incomplete for the day.
 */
export function isStreakVisuallyAtRisk(
  status: Pick<StreakStatus, 'at_risk' | 'current_streak'>,
  now = new Date(),
): boolean {
  if (!status.at_risk || status.current_streak <= 0) return false;
  return msUntilLocalMidnight(now) <= STREAK_WARN_HOURS_BEFORE_MIDNIGHT * 60 * 60 * 1000;
}

/** @deprecated Prefer isStreakVisuallyAtRisk */
export const shouldShowStreakAtRiskCard = isStreakVisuallyAtRisk;

export function needsStreakReminders(
  status: Pick<StreakStatus, 'at_risk' | 'current_streak' | 'user_active_today' | 'both_active_today'>,
): boolean {
  return (
    status.at_risk &&
    status.current_streak > 0 &&
    !status.user_active_today &&
    !status.both_active_today
  );
}
