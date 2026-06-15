import { differenceInCalendarWeeks, startOfWeek } from 'date-fns';

import { WATCH_BADGES, type WatchBadge } from '@/constants/watch-together';
import type { WatchHistoryEntry } from '@/types/database';

export interface WatchStats {
  watched: number;
  /** Consecutive weeks (including current) with at least one session. */
  streakWeeks: number;
  /** Distinct platforms watched on. */
  platforms: number;
  partiesThisWeek: number;
}

export function computeWatchStats(history: WatchHistoryEntry[]): WatchStats {
  const watched = history.length;

  const platforms = new Set(history.map((h) => h.platform_id).filter(Boolean)).size;

  const now = new Date();
  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const partiesThisWeek = history.filter(
    (h) => new Date(h.watched_at) >= thisWeekStart,
  ).length;

  // Streak: walk back week-by-week while each week has an entry.
  const weeksWithWatch = new Set(
    history.map((h) => differenceInCalendarWeeks(now, new Date(h.watched_at), { weekStartsOn: 1 })),
  );
  let streakWeeks = 0;
  while (weeksWithWatch.has(streakWeeks)) streakWeeks += 1;

  return { watched, streakWeeks, platforms, partiesThisWeek };
}

export function earnedBadges(stats: WatchStats): WatchBadge[] {
  return WATCH_BADGES.filter((b) => b.earned(stats));
}

export function nextBadge(stats: WatchStats): WatchBadge | null {
  return WATCH_BADGES.find((b) => !b.earned(stats)) ?? null;
}
