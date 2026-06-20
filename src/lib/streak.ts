import type { StreakStatus } from '@/types/database';

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
  };
}

export function streakSubtitle(status: StreakStatus): string {
  if (status.can_restore_streak && status.restorable_streak) {
    return `Restore your ${status.restorable_streak}-day streak before starting over`;
  }
  if (status.current_streak <= 0) {
    return 'Send a moment, message, or mood to start';
  }
  if (status.at_risk) {
    return status.user_active_today
      ? 'Waiting on your partner today'
      : 'Act today to keep your streak';
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
  };
}
