import {
  format,
  isSameDay,
  isThisWeek,
  isThisYear,
  isToday,
  isYesterday,
  startOfDay,
  startOfWeek,
  subDays,
  subWeeks,
} from 'date-fns';

import { MOOD_EMOJI } from '@/constants/design-system';
import { getFirstName } from '@/lib/avatar-initial';
import type { MoodLog } from '@/types/database';

export type MoodHistoryFilter = 'all' | 'me' | 'partner';

export interface MoodCount {
  mood: string;
  count: number;
  share: number;
}

export interface MoodDayBucket {
  dateKey: string;
  label: string;
  count: number;
  dominantMood: string | null;
}

export interface MoodWeeklyBucket {
  weekKey: string;
  label: string;
  count: number;
  topMood: string | null;
  userId?: string;
}

export interface MoodPartnerWeekRow {
  weekKey: string;
  label: string;
  youCount: number;
  partnerCount: number;
  youMood: string | null;
  partnerMood: string | null;
}

export interface MoodTimelineEntry extends MoodLog {
  isMe: boolean;
  displayName: string;
  timeLabel: string;
}

export interface MoodTimelineSection {
  key: string;
  label: string;
  entries: MoodTimelineEntry[];
}

export interface MoodHistorySummary {
  total: number;
  topMood: string | null;
  topMoodCount: number;
}

export interface MoodHistoryOverviewData {
  summary: MoodHistorySummary;
  counts: MoodCount[];
  daily: MoodDayBucket[];
  weekly: MoodWeeklyBucket[];
  partnerWeekly: MoodPartnerWeekRow[];
}

export interface RpcMoodHistoryOverview {
  summary: {
    total: number;
    top_mood: string | null;
    top_mood_count: number;
  };
  counts: Array<{ mood: string; log_count: number }>;
  daily: Array<{ day_date: string; log_count: number; dominant_mood: string | null }>;
  weekly: Array<{ week_start: string; user_id: string; log_count: number; top_mood: string | null }>;
}

export function getLocalTimezoneOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

export function resolveMoodFilterUserId(
  filter: MoodHistoryFilter,
  userId: string,
  partnerId?: string | null,
): string | null {
  if (filter === 'all') return null;
  if (filter === 'me') return userId;
  return partnerId ?? null;
}

export function filterMoodLogs(
  logs: MoodLog[],
  filter: MoodHistoryFilter,
  userId: string,
  partnerId?: string | null,
): MoodLog[] {
  if (filter === 'all') return logs;
  if (filter === 'me') return logs.filter((log) => log.user_id === userId);
  if (!partnerId) return [];
  return logs.filter((log) => log.user_id === partnerId);
}

export function indexLogsByLocalDay(logs: MoodLog[]): Map<string, MoodLog[]> {
  const map = new Map<string, MoodLog[]>();
  for (const log of logs) {
    const key = format(new Date(log.created_at), 'yyyy-MM-dd');
    const bucket = map.get(key);
    if (bucket) bucket.push(log);
    else map.set(key, [log]);
  }
  return map;
}

export function buildMoodCounts(logs: MoodLog[]): MoodCount[] {
  const counts = new Map<string, number>();
  for (const log of logs) {
    counts.set(log.mood, (counts.get(log.mood) ?? 0) + 1);
  }

  const total = logs.length;
  if (total === 0) return [];

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([mood, count]) => ({ mood, count, share: count / total }));
}

export function buildMoodHistorySummary(logs: MoodLog[]): MoodHistorySummary {
  const counts = buildMoodCounts(logs);
  const top = counts[0];
  return {
    total: logs.length,
    topMood: top?.mood ?? null,
    topMoodCount: top?.count ?? 0,
  };
}

function dominantMoodForLogs(logs: MoodLog[]): string | null {
  const counts = new Map<string, number>();
  for (const log of logs) {
    counts.set(log.mood, (counts.get(log.mood) ?? 0) + 1);
  }

  let dominantMood: string | null = null;
  let dominantCount = 0;
  for (const [mood, count] of counts) {
    if (count > dominantCount) {
      dominantCount = count;
      dominantMood = mood;
    }
  }
  return dominantMood;
}

export function buildDailyActivity(logs: MoodLog[], days = 14): MoodDayBucket[] {
  const byDay = indexLogsByLocalDay(logs);
  const now = new Date();
  const buckets: MoodDayBucket[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = startOfDay(subDays(now, offset));
    const dateKey = format(day, 'yyyy-MM-dd');
    const dayLogs = byDay.get(dateKey) ?? [];

    buckets.push({
      dateKey,
      label: offset === 0 ? 'Today' : format(day, 'EEE'),
      count: dayLogs.length,
      dominantMood: dayLogs.length > 0 ? dominantMoodForLogs(dayLogs) : null,
    });
  }

  return buckets;
}

export function buildWeeklyActivity(logs: MoodLog[], weeks = 8, userId?: string | null): MoodWeeklyBucket[] {
  const scoped = userId ? logs.filter((log) => log.user_id === userId) : logs;
  const now = new Date();
  const buckets: MoodWeeklyBucket[] = [];

  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const weekStart = startOfWeek(subWeeks(now, offset), { weekStartsOn: 1 });
    const weekEnd = startOfWeek(subWeeks(weekStart, -1), { weekStartsOn: 1 });
    const weekKey = format(weekStart, 'yyyy-MM-dd');
    const weekLogs = scoped.filter((log) => {
      const created = new Date(log.created_at);
      return created >= weekStart && created < weekEnd;
    });

    buckets.push({
      weekKey,
      label: offset === 0 ? 'This wk' : format(weekStart, 'MMM d'),
      count: weekLogs.length,
      topMood: weekLogs.length > 0 ? dominantMoodForLogs(weekLogs) : null,
      userId: userId ?? undefined,
    });
  }

  return buckets;
}

export function buildPartnerWeeklyComparison(
  weeklyRows: Array<{ week_start: string; user_id: string; log_count: number; top_mood: string | null }>,
  userId: string,
  partnerId?: string | null,
): MoodPartnerWeekRow[] {
  if (!partnerId) return [];

  const byWeek = new Map<string, MoodPartnerWeekRow>();
  for (const row of weeklyRows) {
    const weekKey = row.week_start.slice(0, 10);
    const existing =
      byWeek.get(weekKey) ??
      ({
        weekKey,
        label: format(new Date(`${weekKey}T12:00:00`), 'MMM d'),
        youCount: 0,
        partnerCount: 0,
        youMood: null,
        partnerMood: null,
      } satisfies MoodPartnerWeekRow);

    if (row.user_id === userId) {
      existing.youCount = row.log_count;
      existing.youMood = row.top_mood;
    } else if (row.user_id === partnerId) {
      existing.partnerCount = row.log_count;
      existing.partnerMood = row.top_mood;
    }

    byWeek.set(weekKey, existing);
  }

  return [...byWeek.values()].sort((a, b) => a.weekKey.localeCompare(b.weekKey));
}

export function mapRpcOverview(
  payload: RpcMoodHistoryOverview,
  userId: string,
  partnerId?: string | null,
): MoodHistoryOverviewData {
  const total = payload.summary.total ?? 0;
  const counts = (payload.counts ?? []).map((row) => ({
    mood: row.mood,
    count: row.log_count,
    share: total > 0 ? row.log_count / total : 0,
  }));

  const daily = (payload.daily ?? []).map((row) => {
    const dateKey = row.day_date.slice(0, 10);
    const date = new Date(`${dateKey}T12:00:00`);
    return {
      dateKey,
      label: isToday(date) ? 'Today' : format(date, 'EEE'),
      count: row.log_count,
      dominantMood: row.dominant_mood,
    };
  });

  const weekly = (payload.weekly ?? []).map((row) => ({
    weekKey: row.week_start.slice(0, 10),
    label: format(new Date(`${row.week_start.slice(0, 10)}T12:00:00`), 'MMM d'),
    count: row.log_count,
    topMood: row.top_mood,
    userId: row.user_id,
  }));

  return {
    summary: {
      total,
      topMood: payload.summary.top_mood,
      topMoodCount: payload.summary.top_mood_count ?? 0,
    },
    counts,
    daily,
    weekly,
    partnerWeekly: buildPartnerWeeklyComparison(payload.weekly ?? [], userId, partnerId),
  };
}

export function buildPartnerWeeklyFromLogs(
  logs: MoodLog[],
  userId: string,
  partnerId?: string | null,
  weeks = 8,
): MoodPartnerWeekRow[] {
  if (!partnerId) return [];

  const youWeeks = buildWeeklyActivity(logs, weeks, userId);
  const partnerWeeks = buildWeeklyActivity(logs, weeks, partnerId);

  return youWeeks.map((you, index) => ({
    weekKey: you.weekKey,
    label: you.label,
    youCount: you.count,
    partnerCount: partnerWeeks[index]?.count ?? 0,
    youMood: you.topMood,
    partnerMood: partnerWeeks[index]?.topMood ?? null,
  }));
}

export function buildOverviewFromLogs(
  logs: MoodLog[],
  userId: string,
  partnerId?: string | null,
): MoodHistoryOverviewData {
  return {
    summary: buildMoodHistorySummary(logs),
    counts: buildMoodCounts(logs),
    daily: buildDailyActivity(logs),
    weekly: buildWeeklyActivity(logs),
    partnerWeekly: buildPartnerWeeklyFromLogs(logs, userId, partnerId),
  };
}

function moodTimelineSectionLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, 'EEEE');
  if (isThisYear(date)) return format(date, 'MMMM d');
  return format(date, 'MMM d, yyyy');
}

export function buildMoodTimeline(
  logs: MoodLog[],
  userId: string,
  partnerName?: string | null,
): MoodTimelineSection[] {
  const sections = new Map<string, MoodTimelineSection>();
  const sorted = [...logs].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  for (const log of sorted) {
    const date = new Date(log.created_at);
    const key = format(date, 'yyyy-MM-dd');
    const isMe = log.user_id === userId;
    const displayName = isMe ? 'Me' : (getFirstName(partnerName) ?? 'Partner');

    if (!sections.has(key)) {
      sections.set(key, { key, label: moodTimelineSectionLabel(date), entries: [] });
    }

    sections.get(key)!.entries.push({
      ...log,
      isMe,
      displayName,
      timeLabel: format(date, 'h:mm a'),
    });
  }

  return [...sections.values()];
}

export function moodEmoji(mood: string | null | undefined): string {
  if (!mood) return '·';
  return MOOD_EMOJI[mood] ?? '✨';
}
