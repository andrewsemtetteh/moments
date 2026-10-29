import { addDays, differenceInCalendarDays, format } from 'date-fns';

import { isStreakVisuallyAtRisk } from '@/lib/streak-reminder-timing';
import type { StreakStatus } from '@/types/database';

/** Day one after a streak is lost: restoring is free with Plus. */
export const STREAK_RESTORE_FREE_MS = 24 * 60 * 60 * 1000;
/** A lost streak can be restored for 5 days (a paid restore after day one); then it's gone. */
export const STREAK_RESTORE_WINDOW_MS = 5 * STREAK_RESTORE_FREE_MS;

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

/** Restore is only offered within 5 days of when the streak was lost. */
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
  return streakRestoreMsLeft(status, now) > 0;
}

/** When the restore is gone for good: the server's deadline, else 5 days from the loss. */
function restoreDeadline(status: StreakStatus, now: Date): number | null {
  if (status.restore_until) {
    const until = new Date(status.restore_until).getTime();
    if (!Number.isNaN(until)) return until;
  }
  const lostAt = resolveRestorableLostAt(status.restorable_lost_at, status.last_active_date, now);
  if (!lostAt) return null;
  const lost = parseLostAt(lostAt).getTime();
  return Number.isNaN(lost) ? null : lost + STREAK_RESTORE_WINDOW_MS;
}

/** How long is left to restore the lost streak (0 once the window has closed). */
export function streakRestoreMsLeft(status: StreakStatus, now = new Date()): number {
  const deadline = restoreDeadline(status, now);
  return deadline == null ? 0 : Math.max(0, deadline - now.getTime());
}

/**
 * Restoring is free right now: Plus, on the day it was lost (the server says so; the free day
 * also runs out here while the app is open). Otherwise it takes a paid restore.
 */
export function isStreakRestoreFree(status: StreakStatus, now = new Date()): boolean {
  if (!status.restore_free || !status.restore_free_until) return false;
  return now.getTime() < new Date(status.restore_free_until).getTime();
}

/** How long Plus's free day has left (0 once it's over, or when it isn't free). */
export function streakRestoreFreeMsLeft(status: StreakStatus, now = new Date()): number {
  if (!isStreakRestoreFree(status, now)) return 0;
  return Math.max(0, new Date(status.restore_free_until!).getTime() - now.getTime());
}

/** Still on the day it was lost (the day Plus restores it free), for anyone. */
export function isStreakRestoreFirstDay(status: StreakStatus, now = new Date()): boolean {
  if (status.restore_free_until) return now.getTime() < new Date(status.restore_free_until).getTime();
  return streakRestoreMsLeft(status, now) > STREAK_RESTORE_WINDOW_MS - STREAK_RESTORE_FREE_MS;
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
    restore_free_until: typeof row.restore_free_until === 'string' ? row.restore_free_until : null,
    restore_until: typeof row.restore_until === 'string' ? row.restore_until : null,
    restore_free: row.restore_free === true,
    restore_credits: typeof row.restore_credits === 'number' ? row.restore_credits : 0,
    active_days: 'active_days' in row ? parseActiveDays(row.active_days) : undefined,
    activity_days: 'activity_days' in row ? parseActiveDays(row.activity_days) : undefined,
    streak_freezes: typeof row.streak_freezes === 'number' ? row.streak_freezes : undefined,
    frozen_days: 'frozen_days' in row ? parseActiveDays(row.frozen_days) : undefined,
    partner_streak: typeof row.partner_streak === 'number' ? row.partner_streak : undefined,
    partner_longest_streak: typeof row.partner_longest_streak === 'number' ? row.partner_longest_streak : undefined,
    partner_at_risk: row.partner_at_risk === true,
    partner_ends_soon: typeof row.partner_ends_soon === 'boolean' ? row.partner_ends_soon : undefined,
    together_streak: typeof row.together_streak === 'number' ? row.together_streak : undefined,
    together_longest_streak: typeof row.together_longest_streak === 'number' ? row.together_longest_streak : undefined,
    together_days: 'together_days' in row ? parseActiveDays(row.together_days) : undefined,
  };
}

function parseActiveDays(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d));
}

export function streakSubtitle(status: StreakStatus, now = new Date()): string {
  if (isStreakRestoreAvailable(status)) {
    return `Restore your ${status.restorable_streak}-day streak before starting over`;
  }
  if (status.current_streak <= 0) {
    return 'Send a moment, share your mood, answer today’s question or play to start';
  }
  if (isStreakVisuallyAtRisk(status, now)) return 'Check in before midnight';
  if (status.at_risk) return 'Check in today to keep it going';
  if (status.both_active_today) return 'You both showed up today';
  if (status.user_active_today) return 'You showed up today';
  if (status.longest_streak > status.current_streak) {
    return `Your best: ${status.longest_streak} days`;
  }
  return 'Keep it going';
}

/** Your partner's streak (0 when they haven't one going, or on an older server). */
export function partnerStreakCount(status: StreakStatus | null | undefined): number {
  return Math.max(0, status?.partner_streak ?? 0);
}

/**
 * Your partner's streak ends tonight and they're in its last few hours: the same "ends
 * tonight" moment as yours. Older servers didn't say; then your own clock stands in.
 */
export function isPartnerStreakEndingSoon(status: StreakStatus, now = new Date()): boolean {
  if (!status.partner_at_risk || status.partner_active_today) return false;
  if (status.partner_ends_soon !== undefined) return status.partner_ends_soon;
  return isStreakVisuallyAtRisk({ at_risk: true, current_streak: partnerStreakCount(status) }, now);
}

/** Days in a row you both showed up (older servers: the couple streak itself). */
export function togetherStreakCount(status: StreakStatus | null | undefined): number {
  return Math.max(0, status?.together_streak ?? status?.current_streak ?? 0);
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
