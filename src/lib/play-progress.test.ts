import { describe, expect, it } from 'vitest';

import {
  activeStreak,
  applyAward,
  emptyProgress,
  levelFromXp,
  levelInfo,
  normalizeProgress,
  questsForDate,
  questView,
  titleForLevel,
  xpForLevel,
  BADGES,
  nextBadges,
} from './play-progress';

describe('levels', () => {
  it('has increasing thresholds and consistent level lookup', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(200);
    expect(xpForLevel(3)).toBe(500);
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(199)).toBe(1);
    expect(levelFromXp(200)).toBe(2);
    expect(levelFromXp(500)).toBe(3);
    for (let l = 1; l < 300; l++) {
      expect(levelFromXp(xpForLevel(l))).toBe(l);
      expect(levelFromXp(xpForLevel(l + 1) - 1)).toBe(l);
    }
  });

  it('reports progress within the current level', () => {
    const info = levelInfo(300);
    expect(info.level).toBe(2);
    expect(info.into).toBe(100);
    expect(info.span).toBe(300);
    expect(info.progress).toBeCloseTo(1 / 3);
  });

  it('names every level, with no ceiling', () => {
    expect(titleForLevel(1)).toBe('Sparks Fly I');
    expect(titleForLevel(5)).toBe('Sparks Fly V');
    expect(titleForLevel(6)).toBe('Crushing I');
    expect(titleForLevel(100)).toBe('Eternal V');
    expect(titleForLevel(101)).toBe('Timeless 1');
    expect(titleForLevel(250)).toBe('Timeless 150');
  });
});

describe('trophies', () => {
  it('has unique ids and keeps the original ones', () => {
    const ids = BADGES.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['first_game', 'live_first', 'ten_games', 'streak_3', 'sync_10', 'dares_5', 'truths_10', 'detective', 'live_ten', 'quiz_ace', 'streak_7', 'level_5', 'sync_50', 'fifty_games', 'streak_30', 'level_10']) {
      expect(ids).toContain(id);
    }
    expect(BADGES.length).toBeGreaterThan(80);
  });

  it('suggests the next trophy on each ladder', () => {
    const p = { ...emptyProgress('2026-09-24'), stats: { games_played: 7 }, badges: ['first_game'] };
    const next = nextBadges(p, 50);
    const games = next.find((n) => n.badge.group === 'Games');
    expect(games?.badge.id).toBe('ten_games');
    expect(games?.value).toBe(7);
    expect(next[0].badge.id).toBe('ten_games');
  });
});

describe('daily quests', () => {
  it('is deterministic per date and always has 3 distinct quests', () => {
    const a = questsForDate('2026-09-24');
    const b = questsForDate('2026-09-24');
    expect(a.map((q) => q.id)).toEqual(b.map((q) => q.id));
    expect(new Set(a.map((q) => q.id)).size).toBe(3);
    expect(a.some((q) => q.id === 'play_any' || q.id === 'daily_q')).toBe(true);
  });
});

describe('applyAward', () => {
  const today = '2026-09-24';

  it('adds xp, stats and starts a streak', () => {
    const r = applyAward(emptyProgress(today), { xp: 50, stats: { games_played: 1, live_games: 1 } }, today);
    expect(r.progress.xp).toBeGreaterThanOrEqual(50);
    expect(r.progress.stats.games_played).toBe(1);
    expect(r.progress.playStreak).toBe(1);
    expect(r.streakExtended).toBe(true);
    expect(r.newBadges.map((b) => b.id)).toEqual(expect.arrayContaining(['first_game', 'live_first']));
  });

  it('extends a streak on consecutive days and resets after a gap', () => {
    const day1 = applyAward(emptyProgress('2026-09-22'), { xp: 10, stats: { games_played: 1 } }, '2026-09-22');
    const day2 = applyAward(day1.progress, { xp: 10, stats: { games_played: 1 } }, '2026-09-23');
    expect(day2.progress.playStreak).toBe(2);
    const same = applyAward(day2.progress, { xp: 10, stats: { games_played: 1 } }, '2026-09-23');
    expect(same.progress.playStreak).toBe(2);
    expect(same.streakExtended).toBe(false);
    const gap = applyAward(same.progress, { xp: 10, stats: { games_played: 1 } }, '2026-09-26');
    expect(gap.progress.playStreak).toBe(1);
    expect(gap.progress.bestStreak).toBe(2);
  });

  it('claims completed quests exactly once and grants their reward', () => {
    const quests = questsForDate(today);
    const q = quests[0];
    const first = applyAward(emptyProgress(today), { xp: 0, events: { [q.event]: q.target } }, today);
    expect(first.completedQuests.map((c) => c.id)).toContain(q.id);
    expect(first.gainedXp).toBeGreaterThanOrEqual(q.reward);
    const again = applyAward(first.progress, { xp: 0, events: { [q.event]: q.target } }, today);
    expect(again.completedQuests.map((c) => c.id)).not.toContain(q.id);
  });

  it('resets quest counters on a new day', () => {
    const first = applyAward(emptyProgress('2026-09-23'), { xp: 5, events: { game_played: 1 } }, '2026-09-23');
    const next = applyAward(first.progress, { xp: 5, events: {} }, '2026-09-24');
    expect(next.progress.quests.date).toBe('2026-09-24');
    expect(next.progress.quests.counts.game_played ?? 0).toBe(0);
  });

  it('only rewards a solo activity once per day', () => {
    const first = applyAward(emptyProgress(today), { xp: 12, stats: { games_played: 1 }, soloId: 'cards' }, today);
    const again = applyAward(first.progress, { xp: 12, stats: { games_played: 1 }, soloId: 'cards' }, today);
    expect(first.progress.xp).toBeGreaterThanOrEqual(12);
    expect(again.gainedXp).toBe(0);
    expect(again.progress.stats.games_played).toBe(1);
  });

  it('reports level-ups', () => {
    const r = applyAward(emptyProgress(today), { xp: 200 }, today);
    expect(r.levelBefore).toBe(1);
    expect(r.levelAfter).toBeGreaterThanOrEqual(2);
  });
});

describe('helpers', () => {
  it('shows quest progress and a broken streak', () => {
    const p = applyAward(emptyProgress('2026-09-20'), { xp: 5, stats: { games_played: 1 } }, '2026-09-20').progress;
    expect(activeStreak(p, '2026-09-21')).toBe(1);
    expect(activeStreak(p, '2026-09-24')).toBe(0);
    expect(questView(p, '2026-09-24')).toHaveLength(3);
  });

  it('normalizes junk rows safely', () => {
    expect(normalizeProgress(null, '2026-09-24').xp).toBe(0);
    const n = normalizeProgress({ xp: 40.7, play_streak: 3, best_streak: 5, stats: { a: 1, b: 'x' }, badges: ['x', 3] }, '2026-09-24');
    expect(n.xp).toBe(40);
    expect(n.playStreak).toBe(3);
    expect(n.stats).toEqual({ a: 1 });
    expect(n.badges).toEqual(['x']);
  });
});
