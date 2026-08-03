import { describe, expect, it } from 'vitest';
import { startOfMonth } from 'date-fns';

import {
  buildStreakMonth,
  buildStreakWeek,
  streakMonthNavBounds,
  streakWeekLineSpan,
} from '@/lib/streak-days';
import type { StreakStatus } from '@/types/database';

function baseStatus(overrides: Partial<StreakStatus> = {}): StreakStatus {
  return {
    relationship_id: 'rel-1',
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
    ...overrides,
  };
}

describe('buildStreakWeek', () => {
  const now = new Date('2026-06-25T15:00:00');
  const joinedAt = '2026-06-01T12:00:00';

  it('returns 7 days for the current week', () => {
    expect(buildStreakWeek(baseStatus(), joinedAt, now)).toHaveLength(7);
  });

  it('marks days before join as inactive', () => {
    const days = buildStreakWeek(baseStatus(), '2026-06-24T12:00:00', now);
    const mon = days.find((d) => d.weekdayLabel === 'Mon');
    expect(mon?.state).toBe('inactive');
  });

  it('marks streak days as completed with fire state', () => {
    const days = buildStreakWeek(
      baseStatus({
        current_streak: 3,
        last_active_date: '2026-06-25',
        both_active_today: true,
      }),
      joinedAt,
      now,
    );
    const active = days.filter((d) => d.state === 'completed' || d.state === 'today-done');
    expect(active).toHaveLength(3);
    expect(streakWeekLineSpan(days)).not.toBeNull();
  });

  it('marks past non-streak days without activity as missed', () => {
    const days = buildStreakWeek(
      baseStatus({
        current_streak: 2,
        last_active_date: '2026-06-25',
        both_active_today: true,
      }),
      joinedAt,
      now,
    );
    const mon = days.find((d) => d.weekdayLabel === 'Mon');
    expect(mon?.state).toBe('missed');
  });

  it('marks gaps between activity days as missed in the month view', () => {
    const { days } = buildStreakMonth(
      baseStatus({
        current_streak: 0,
        activity_days: ['2026-06-20', '2026-06-25'],
      }),
      startOfMonth(now),
      joinedAt,
      now,
    );
    expect(days.find((d) => d.dayOfMonth === 20)?.state).toBe('completed');
    expect(days.find((d) => d.dayOfMonth === 22)?.state).toBe('missed');
    expect(days.find((d) => d.dayOfMonth === 23)?.state).toBe('missed');
  });

  it('marks activity days with fire even when streak is zero', () => {
    const days = buildStreakWeek(
      baseStatus({
        current_streak: 0,
        activity_days: ['2026-06-23', '2026-06-24'],
      }),
      joinedAt,
      now,
    );
    expect(days.find((d) => d.weekdayLabel === 'Tue')?.state).toBe('completed');
    expect(days.find((d) => d.weekdayLabel === 'Wed')?.state).toBe('completed');
  });

  it('keeps pending UI until the last 3 hours before midnight', () => {
    const days = buildStreakWeek(
      baseStatus({
        current_streak: 5,
        last_active_date: '2026-06-24',
        at_risk: true,
        both_active_today: false,
      }),
      joinedAt,
      now,
    );
    const today = days.find((d) => d.isToday);
    expect(today?.state).toBe('today-pending');
  });

  it('shows at-risk UI in the last 3 hours before midnight', () => {
    const late = new Date('2026-06-25T22:00:00');
    const days = buildStreakWeek(
      baseStatus({
        current_streak: 5,
        last_active_date: '2026-06-24',
        at_risk: true,
        both_active_today: false,
      }),
      joinedAt,
      late,
    );
    const today = days.find((d) => d.isToday);
    expect(today?.state).toBe('today-at-risk');
  });

  it('uses green for streaked days and yellow for activity-only days', () => {
    const days = buildStreakWeek(
      baseStatus({
        current_streak: 2,
        last_active_date: '2026-06-25',
        both_active_today: true,
        active_days: ['2026-06-24', '2026-06-25'],
        activity_days: ['2026-06-23', '2026-06-24', '2026-06-25'],
      }),
      joinedAt,
      now,
    );
    expect(days.find((d) => d.isToday)?.tone).toBe('success');
    expect(days.find((d) => d.weekdayLabel === 'Wed')?.tone).toBe('success');
    expect(days.find((d) => d.weekdayLabel === 'Tue')?.tone).toBe('success');
  });

  it('shows awaiting-streak UI for today before both partners check in', () => {
    const late = new Date('2026-06-25T22:00:00');
    const days = buildStreakWeek(
      baseStatus({
        current_streak: 3,
        last_active_date: '2026-06-24',
        at_risk: true,
        user_active_today: true,
        partner_active_today: false,
      }),
      joinedAt,
      late,
    );
    const today = days.find((d) => d.isToday);
    expect(today?.state).toBe('today-at-risk');
  });

  it('shows pending UI for today with no streak yet', () => {
    const days = buildStreakWeek(baseStatus(), joinedAt, now);
    expect(days.find((d) => d.isToday)?.state).toBe('today-pending');
  });

  it('shows fire for historical active days beyond the current streak window', () => {
    const { days } = buildStreakMonth(
      baseStatus({
        current_streak: 2,
        last_active_date: '2026-06-25',
        both_active_today: true,
        active_days: ['2026-06-20', '2026-06-21', '2026-06-24', '2026-06-25'],
      }),
      startOfMonth(now),
      joinedAt,
      now,
    );
    expect(days.find((d) => d.dayOfMonth === 20)?.state).toBe('completed');
    expect(days.find((d) => d.dayOfMonth === 21)?.state).toBe('completed');
  });
});

describe('buildStreakMonth', () => {
  const now = new Date('2026-06-25T15:00:00');
  const joinedAt = '2026-06-10T12:00:00';

  it('builds a full month grid with streak and missed states', () => {
    const { days, leadingBlanks } = buildStreakMonth(
      baseStatus({
        current_streak: 4,
        last_active_date: '2026-06-25',
        both_active_today: true,
      }),
      startOfMonth(now),
      joinedAt,
      now,
    );
    expect(days).toHaveLength(30);
    expect(leadingBlanks).toBeGreaterThanOrEqual(0);
    expect(days[0].state).toBe('inactive');
    expect(days.filter((d) => d.state === 'completed' || d.state === 'today-done')).toHaveLength(4);
    expect(days.filter((d) => d.state === 'missed').length).toBeGreaterThan(0);
  });
});

describe('streakMonthNavBounds', () => {
  const now = new Date('2026-06-25T15:00:00');

  it('starts from join month', () => {
    const bounds = streakMonthNavBounds('2026-03-15T00:00:00', now);
    expect(bounds.minMonth).toEqual(startOfMonth(new Date('2026-03-15')));
    expect(bounds.maxMonth).toEqual(startOfMonth(now));
  });
});
