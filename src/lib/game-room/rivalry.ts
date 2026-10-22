import type { CoupleProgress } from '@/lib/play-progress';
import { todayKey } from '@/lib/play-progress';

import { getGameDefinition, type LiveGameKind, type RoomResult } from './types';

/**
 * Your rivalry: who wins your versus games, all time and in this month's season, and your best
 * sync score in each team game. Kept as counters in the couple's progress stats, so both phones
 * see the same record and it syncs like XP:
 *   vs_win:<userId>, vs_tie                  all time
 *   vs_win:<userId>:<YYYY-MM>, vs_tie:<YYYY-MM>   one season (a calendar month)
 *   sync_best:<game>                          best % in sync (kept as a best, not a total)
 */

/** This season's key: the calendar month, e.g. "2026-10". */
export function seasonKey(date: string = todayKey()): string {
  return date.slice(0, 7);
}

/** "October", or "October 2025" when it isn't this year. */
export function seasonName(key: string, now: string = todayKey()): string {
  const [y, m] = key.split('-').map(Number);
  const month = new Date(y, (m || 1) - 1, 1).toLocaleString('en', { month: 'long' });
  return String(y) === now.slice(0, 4) ? month : `${month} ${y}`;
}

/** The season before `key`. */
export function previousSeason(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, (m || 1) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** What a finished game adds to your record (call once, with the game's award). */
export function rivalryAward(
  game: LiveGameKind,
  result: RoomResult | null,
  season: string = seasonKey(),
): { stats: Record<string, number>; maxStats: Record<string, number> } {
  const stats: Record<string, number> = {};
  const maxStats: Record<string, number> = {};
  if (!result) return { stats, maxStats };
  if (getGameDefinition(game).team) {
    if (typeof result.syncPct === 'number') maxStats[`sync_best:${game}`] = result.syncPct;
  } else if (result.winnerId) {
    stats[`vs_win:${result.winnerId}`] = 1;
    stats[`vs_win:${result.winnerId}:${season}`] = 1;
  } else {
    stats.vs_tie = 1;
    stats[`vs_tie:${season}`] = 1;
  }
  return { stats, maxStats };
}

export interface Score {
  me: number;
  them: number;
  ties: number;
}

export interface Rivalry {
  allTime: Score;
  season: Score & { key: string };
  /** Last month's season, when you played in it. */
  lastSeason: (Score & { key: string; championId: string | null }) | null;
  /** Past seasons with a winner, newest first (for the trophy shelf). */
  champions: { key: string; championId: string | null; me: number; them: number }[];
}

function recordFor(stats: Record<string, number>, meId: string, themId: string, suffix = ''): Score {
  return {
    me: stats[`vs_win:${meId}${suffix}`] ?? 0,
    them: stats[`vs_win:${themId}${suffix}`] ?? 0,
    ties: stats[`vs_tie${suffix}`] ?? 0,
  };
}

export function readRivalry(
  progress: CoupleProgress | null,
  meId: string,
  themId: string,
  today: string = todayKey(),
): Rivalry {
  const stats = progress?.stats ?? {};
  const key = seasonKey(today);
  const lastKey = previousSeason(key);
  const last = recordFor(stats, meId, themId, `:${lastKey}`);
  const championOf = (r: Score) => (r.me > r.them ? meId : r.them > r.me ? themId : null);

  // Every past season that shows up in the counters.
  const keys = new Set<string>();
  for (const k of Object.keys(stats)) {
    const m = /^vs_(?:win:[^:]+|tie):(\d{4}-\d{2})$/.exec(k);
    if (m && m[1] < key) keys.add(m[1]);
  }
  const champions = [...keys]
    .sort()
    .reverse()
    .map((k) => {
      const r = recordFor(stats, meId, themId, `:${k}`);
      return { key: k, championId: championOf(r), me: r.me, them: r.them };
    });

  return {
    allTime: recordFor(stats, meId, themId),
    season: { ...recordFor(stats, meId, themId, `:${key}`), key },
    lastSeason: last.me + last.them + last.ties > 0 ? { ...last, key: lastKey, championId: championOf(last) } : null,
    champions,
  };
}

/** Your best sync score in a team game, or null before you've played it. */
export function bestSync(progress: CoupleProgress | null, game: LiveGameKind): number | null {
  const v = progress?.stats[`sync_best:${game}`];
  return typeof v === 'number' ? v : null;
}

/** Who's ahead, in a few words: "You lead 12–9", "Sam leads 4–2", "All square at 3". */
export function leadLine(r: Score, themName: string): string {
  if (r.me === r.them) return r.me === 0 ? 'No wins yet' : `All square at ${r.me}`;
  return r.me > r.them ? `You lead ${r.me}–${r.them}` : `${themName} leads ${r.them}–${r.me}`;
}
