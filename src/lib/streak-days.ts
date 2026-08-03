import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
} from 'date-fns';

import type { StreakStatus } from '@/types/database';
import { isStreakVisuallyAtRisk } from '@/lib/streak-reminder-timing';

export type StreakView = 'week' | 'month';

export type StreakDayState =
  | 'completed'
  | 'today-done'
  | 'today-pending'
  | 'today-at-risk'
  | 'missed'
  | 'idle'
  | 'future'
  | 'inactive';

export type StreakDayTone = 'success' | 'streak';

export interface StreakDayCell {
  date: Date;
  weekdayLabel: string;
  dayOfMonth: number;
  isToday: boolean;
  state: StreakDayState;
  tone?: StreakDayTone;
}

export type StreakMonthDay = StreakDayCell;

const WEEK_OPTS = { weekStartsOn: 1 as const };

function parseJoinedDay(joinedAt?: string | Date | null): Date | null {
  if (!joinedAt) return null;
  return startOfDay(typeof joinedAt === 'string' ? new Date(joinedAt) : joinedAt);
}

function dayKey(date: Date): string {
  return format(startOfDay(date), 'yyyy-MM-dd');
}

function buildStreakWindowSet(status: StreakStatus): Set<string> {
  const lastActive = status.last_active_date
    ? startOfDay(new Date(`${status.last_active_date}T12:00:00`))
    : null;

  const days = new Set<string>();
  if (lastActive && status.current_streak > 0) {
    for (let i = 0; i < status.current_streak; i++) {
      days.add(format(subDays(lastActive, i), 'yyyy-MM-dd'));
    }
  }
  return days;
}

/** All calendar days that should show the streak icon. */
export function buildActiveDaySet(status: StreakStatus, now = new Date()): Set<string> {
  const days = new Set<string>();

  for (const d of status.active_days ?? []) {
    days.add(d);
  }
  for (const d of status.activity_days ?? []) {
    days.add(d);
  }
  for (const d of buildStreakWindowSet(status)) {
    days.add(d);
  }

  const todayKey = dayKey(now);
  if (status.both_active_today) {
    days.add(todayKey);
  }

  return days;
}

function resolveDayTone(_key: string, _status: StreakStatus): StreakDayTone {
  return 'success';
}

function resolveDayState(
  date: Date,
  today: Date,
  activeDays: Set<string>,
  status: StreakStatus,
  joinedDay: Date | null,
  now: Date,
): Pick<StreakDayCell, 'state' | 'tone'> {
  if (joinedDay && isBefore(date, joinedDay)) return { state: 'inactive' };

  const key = dayKey(date);
  const isToday = isSameDay(date, today);

  if (isAfter(date, today)) return { state: 'future' };

  if (isToday) {
    if (status.both_active_today) {
      return { state: 'today-done', tone: 'success' };
    }
    if (status.current_streak > 0 && isStreakVisuallyAtRisk(status, now)) {
      return { state: 'today-at-risk' };
    }
    return { state: 'today-pending' };
  }

  if (activeDays.has(key)) {
    return { state: 'completed', tone: resolveDayTone(key, status) };
  }

  return { state: 'missed' };
}

function toDayCell(
  date: Date,
  today: Date,
  activeDays: Set<string>,
  status: StreakStatus,
  joinedDay: Date | null,
  now: Date,
): StreakDayCell {
  const { state, tone } = resolveDayState(date, today, activeDays, status, joinedDay, now);
  return {
    date,
    weekdayLabel: format(date, 'EEE'),
    dayOfMonth: date.getDate(),
    isToday: isSameDay(date, today),
    state,
    tone,
  };
}

/** Current calendar week (Mon–Sun). */
export function buildStreakWeek(
  status: StreakStatus,
  joinedAt?: string | Date | null,
  now = new Date(),
): StreakDayCell[] {
  const today = startOfDay(now);
  const weekStart = startOfWeek(today, WEEK_OPTS);
  const weekEnd = endOfWeek(today, WEEK_OPTS);
  const activeDays = buildActiveDaySet(status, now);
  const joinedDay = parseJoinedDay(joinedAt);

  const cells: StreakDayCell[] = [];
  let cursor = weekStart;
  while (!isAfter(cursor, weekEnd)) {
    cells.push(toDayCell(cursor, today, activeDays, status, joinedDay, now));
    cursor = addDays(cursor, 1);
  }

  return cells;
}

/** Week row for milestone modal — filled days match the streak window for `milestoneCount`. */
export function buildMilestoneWeek(
  milestoneCount: number,
  joinedAt?: string | Date | null,
  status?: StreakStatus | null,
  now = new Date(),
): StreakDayCell[] {
  const today = startOfDay(now);
  const weekStart = startOfWeek(today, WEEK_OPTS);
  const weekEnd = endOfWeek(today, WEEK_OPTS);
  const joinedDay = parseJoinedDay(joinedAt);
  const streakStart = subDays(today, Math.max(0, milestoneCount - 1));

  const cells: StreakDayCell[] = [];
  let cursor = weekStart;
  while (!isAfter(cursor, weekEnd)) {
    const isToday = isSameDay(cursor, today);

    if (joinedDay && isBefore(cursor, joinedDay)) {
      cells.push({
        date: cursor,
        weekdayLabel: format(cursor, 'EEE'),
        dayOfMonth: cursor.getDate(),
        isToday,
        state: 'inactive',
      });
    } else if (isAfter(cursor, today)) {
      cells.push({
        date: cursor,
        weekdayLabel: format(cursor, 'EEE'),
        dayOfMonth: cursor.getDate(),
        isToday,
        state: 'future',
      });
    } else if (!isBefore(cursor, streakStart)) {
      if (isToday && status && !status.both_active_today) {
        cells.push({
          date: cursor,
          weekdayLabel: format(cursor, 'EEE'),
          dayOfMonth: cursor.getDate(),
          isToday: true,
          state: isStreakVisuallyAtRisk(status, now) ? 'today-at-risk' : 'today-pending',
        });
      } else {
        cells.push({
          date: cursor,
          weekdayLabel: format(cursor, 'EEE'),
          dayOfMonth: cursor.getDate(),
          isToday,
          state: isToday ? 'today-done' : 'completed',
          tone: 'success',
        });
      }
    } else {
      cells.push({
        date: cursor,
        weekdayLabel: format(cursor, 'EEE'),
        dayOfMonth: cursor.getDate(),
        isToday,
        state: 'missed',
      });
    }

    cursor = addDays(cursor, 1);
  }

  return cells;
}

/** Connector line across consecutive streak days in the week row. */
export function streakWeekLineSpan(days: StreakDayCell[]): { start: number; end: number } | null {
  const hit = days
    .map((day, index) =>
      day.state === 'completed' || day.state === 'today-done' ? index : -1,
    )
    .filter((index) => index >= 0);

  if (hit.length < 2) return null;
  return { start: hit[0], end: hit[hit.length - 1] };
}

export function streakMonthNavBounds(joinedAt?: string | Date | null, now = new Date()) {
  const today = startOfDay(now);
  const joinedDay = parseJoinedDay(joinedAt) ?? today;
  return {
    minMonth: startOfMonth(joinedDay),
    maxMonth: startOfMonth(today),
  };
}

/** Full month grid (week starts Sunday), days since the couple joined. */
export function buildStreakMonth(
  status: StreakStatus,
  month: Date,
  joinedAt?: string | Date | null,
  now = new Date(),
): { days: StreakMonthDay[]; leadingBlanks: number } {
  const today = startOfDay(now);
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const activeDays = buildActiveDaySet(status, now);
  const joinedDay = parseJoinedDay(joinedAt);

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd }).map((date) =>
    toDayCell(date, today, activeDays, status, joinedDay, now),
  );

  return {
    days,
    leadingBlanks: monthStart.getDay(),
  };
}

export function countActiveInMonth(days: StreakMonthDay[]): number {
  return days.filter((day) => day.state === 'completed' || day.state === 'today-done').length;
}

export function dayLabelColor(
  day: StreakDayCell,
  colors: { text: string; textSecondary: string; textTertiary: string },
): string {
  if (day.state === 'completed' || day.state === 'today-done') {
    return STREAK_SUCCESS_LABEL;
  }
  if (day.isToday) return colors.text;
  if (day.state === 'future' || day.state === 'inactive') {
    return colors.textTertiary;
  }
  if (day.state === 'missed') return STREAK_LOST_LABEL;
  if (day.state === 'today-pending') return STREAK_PENDING_LABEL;
  if (day.state === 'today-at-risk') return STREAK_DANGER_LABEL;
  return colors.textSecondary;
}

const STREAK_SUCCESS_LABEL = '#00E676';
const STREAK_PENDING_LABEL = '#CA8A04';
const STREAK_LOST_LABEL = '#9B2C3D';
const STREAK_DANGER_LABEL = '#E85D04';
