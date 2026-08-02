import { addDays, differenceInCalendarDays, format } from 'date-fns';

import type { StreakStatus } from '@/types/database';

export const STREAK_RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000;

function parseLostAt(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`);
  }
  return new Date(value);
}

/** First calendar day the streak is considered lost (day after at-risk). */
export function inferRestorableLostAt(
  lastActiveDate: string | null,
  now = new Date(),
): string | null {
  if (!lastActiveDate) return null;
  const last = new Date(`${lastActiveDate}T00:00:00`);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  last.setHours(0, 0, 0, 0);
  if (differenceInCalendarDays(today, last) < 2) return null;
  return format(addDays(last, 2), 'yyyy-MM-dd');
}

export function resolveRestorableLostAt(
  restorableLostAt: string | null,
  lastActiveDate: string | null,
  now = new Date(),
): string | null {
  return restorableLostAt ?? inferRestorableLostAt(lastActiveDate, now);
}

/** Restore is only offered within 24 hours of when the streak was lost. */
export function isStreakRestoreWindowOpen(
  restorableLostAt: string | null,
  lastActiveDate: string | null = null,
  now = new Date(),
): boolean {
  const lostAt = resolveRestorableLostAt(restorableLostAt, lastActiveDate, now);
  if (!lostAt) return false;
  const lostTime = parseLostAt(lostAt);
  if (Number.isNaN(lostTime.getTime())) return false;
  return now.getTime() - lostTime.getTime() < STREAK_RESTORE_WINDOW_MS;
}

export function isStreakRestoreAvailable(status: StreakStatus, now = new Date()): boolean {
  if (!status.can_restore_streak || status.restorable_streak == null || status.restorable_streak <= 0) {
    return false;
  }
  return isStreakRestoreWindowOpen(status.restorable_lost_at, status.last_active_date, now);
}

export function withEffectiveStreakRestore(status: StreakStatus, now = new Date()): StreakStatus {
  if (isStreakRestoreAvailable(status, now)) return status;
  return { ...status, can_restore_streak: false };
}

export function parseStreakStatus(raw: unknown): StreakStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.relationship_id !== 'string') return null;

  return {
    relationship_id: row.relationship_id,
    current_streak: Number(row.current_streak ?? 0),
    longest_streak: Number(row.longest_streak ?? 0),
    last_active_date: typeof row.last_active_date === 'string' ? row.last_active_date : null,
    at_risk: row.at_risk === true,
    both_active_today: row.both_active_today === true,
    user_active_today: row.user_active_today === true,
    partner_active_today: row.partner_active_today === true,
    can_restore_streak: row.can_restore_streak === true,
    restorable_streak:
      typeof row.restorable_streak === 'number' ? row.restorable_streak : null,
    restorable_lost_at:
      typeof row.restorable_lost_at === 'string' ? row.restorable_lost_at : null,
    active_days: 'active_days' in row ? parseActiveDays(row.active_days) : undefined,
    activity_days: 'activity_days' in row ? parseActiveDays(row.activity_days) : undefined,
  };
}

function parseActiveDays(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
}

export function streakSubtitle(status: StreakStatus): string {
  if (isStreakRestoreAvailable(status)) {
    return `Restore your ${status.restorable_streak}-day streak before starting over`;
  }
  if (status.current_streak <= 0) {
    return 'Send a moment, message, or mood to start';
  }
  if (status.at_risk) {
    return status.user_active_today
      ? 'At risk — waiting on your partner'
      : 'At risk — check in before midnight';
  }
  if (status.both_active_today) {
    return 'You both showed up today';
  }
  if (status.longest_streak > status.current_streak) {
    return `Best together: ${status.longest_streak} days`;
  }
  return 'Keep it going together';
}

export function streakCountLabel(count: number): string {
  return count === 1 ? '1 day streak' : `${count} day streak`;
}

export function streakMotivationHeadline(count: number): string {
  if (count <= 0) return 'Start a streak together';
  if (count === 1) return 'You have a 1 day streak going';
  if (count < 7) return `You have a ${count} day streak going`;
  if (count < 14) return 'You have a 1 week streak going';
  const weeks = Math.floor(count / 7);
  if (count % 7 === 0) {
    return weeks === 1
      ? 'You have a 1 week streak going'
      : `You have a ${weeks} week streak going`;
  }
  return `You have a ${count} day streak going`;
}

export function streakCheerMessage(status: StreakStatus): string {
  if (isStreakRestoreAvailable(status)) {
    return 'Your streak is on pause. Restore it with Plus or start a new one together.';
  }
  if (status.current_streak <= 0) return 'Check in together to begin';
  if (status.at_risk) {
    return status.user_active_today
      ? 'At risk — waiting on your partner'
      : "At risk — don't lose it. Check in today!";
  }
  if (status.both_active_today) return "You're on fire! 🔥";
  if (status.current_streak >= 7) return "You're on fire! 🔥";
  return 'Keep showing up for each other';
}

export type StreakEndVariant = 'restore' | 'at-risk' | 'ended';

export function getStreakEndVariant(status: StreakStatus, now = new Date()): StreakEndVariant | null {
  if (isStreakRestoreAvailable(status, now)) return 'restore';
  if (status.at_risk && status.current_streak > 0) return 'at-risk';
  if (status.current_streak === 0 && status.longest_streak > 0) {
    const onLostDay = isStreakRestoreWindowOpen(
      status.restorable_lost_at,
      status.last_active_date,
      now,
    );
    if (onLostDay && !status.restorable_streak) return 'ended';
  }
  return null;
}

export function shouldShowStreakEndCard(status: StreakStatus): boolean {
  return getStreakEndVariant(status) !== null;
}

export function streakEndLine(status: StreakStatus, variant: StreakEndVariant): string {
  if (variant === 'restore') {
    const count = status.restorable_streak ?? 0;
    const label = count === 1 ? '1 day streak' : `${count} day streak`;
    return `${label} · Restore the day, then streak`;
  }
  if (variant === 'at-risk') {
    return status.user_active_today ? 'Check in with your partner today' : 'Check in today';
  }
  return 'Streak ended · Start again';
}

function isStreakBroken(lastActiveDate: string | null): boolean {
  if (!lastActiveDate) return false;
  const last = new Date(`${lastActiveDate}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays > 1;
}

export function legacyStreakToStatus(
  relationshipId: string,
  row: {
    current_streak: number;
    longest_streak: number;
    last_active_date: string | null;
  },
): StreakStatus {
  const broken = isStreakBroken(row.last_active_date);
  const current = broken ? 0 : row.current_streak;
  let atRiskCalc = false;
  if (row.last_active_date && !broken) {
    const last = new Date(`${row.last_active_date}T12:00:00`);
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    atRiskCalc = diffDays === 1 && current > 0;
  }

  return {
    relationship_id: relationshipId,
    current_streak: current,
    longest_streak: row.longest_streak,
    last_active_date: row.last_active_date,
    at_risk: atRiskCalc,
    both_active_today: false,
    user_active_today: false,
    partner_active_today: false,
    can_restore_streak: false,
    restorable_streak: null,
    restorable_lost_at: null,
    active_days: [],
  };
}

/** Placeholder while streak cache warms — keeps home layout stable like mood. */
export function emptyStreakStatus(relationshipId: string): StreakStatus {
  return {
    relationship_id: relationshipId,
    current_streak: 0,
    longest_streak: 0,
    last_active_date: null,
    at_risk: false,
    both_active_today: false,
    user_active_today: false,
    partner_active_today: false,
    can_restore_streak: false,
    restorable_streak: null,
    restorable_lost_at: null,
    active_days: [],
    activity_days: [],
  };
}
