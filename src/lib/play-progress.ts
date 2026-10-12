/**
 * Couple progression: shared XP + levels, a play streak, daily quests and badges.
 * Everything here is pure so it can be unit-tested and reused for both the remote row
 * (`couple_progress`) and the offline cache.
 */

import type { IconName } from '@/components/ui/Icon';

export interface QuestState {
  /** Local calendar date (YYYY-MM-DD) these counters belong to. */
  date: string;
  counts: Record<string, number>;
  claimed: string[];
  /** Solo activities already rewarded today (so re-opening a card can't farm XP). */
  soloIds: string[];
}

export interface CoupleProgress {
  xp: number;
  stats: Record<string, number>;
  badges: string[];
  playStreak: number;
  bestStreak: number;
  lastPlayDate: string | null;
  quests: QuestState;
}

export interface LevelInfo {
  level: number;
  title: string;
  /** XP earned inside the current level. */
  into: number;
  /** XP needed to clear the current level. */
  span: number;
  progress: number;
  nextTitle: string;
}

const TITLES = [
  'Sparks Fly',
  'Crushing',
  'Sweethearts',
  'Partners in Crime',
  'Power Couple',
  'Soulmates',
  'Legends',
  'Icons',
  'Eternal',
  'Mythic Duo',
];

/** Cumulative XP needed to *reach* a level (level 1 = 0). */
export function xpForLevel(level: number): number {
  const l = Math.max(1, Math.floor(level));
  return 40 * (l - 1) * l;
}

export function titleForLevel(level: number): string {
  return TITLES[Math.min(TITLES.length, Math.max(1, level)) - 1];
}

export function levelFromXp(xp: number): number {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level += 1;
  return level;
}

export function levelInfo(xp: number): LevelInfo {
  const safe = Math.max(0, Math.floor(xp));
  const level = levelFromXp(safe);
  const floor = xpForLevel(level);
  const span = xpForLevel(level + 1) - floor;
  const into = safe - floor;
  return {
    level,
    title: titleForLevel(level),
    into,
    span,
    progress: span > 0 ? Math.min(1, into / span) : 1,
    nextTitle: titleForLevel(level + 1),
  };
}

export interface QuestDef {
  id: string;
  title: string;
  emoji: string;
  /** Shown on the Daily quests card (the emoji is kept for celebrations). */
  icon: IconName;
  event: string;
  target: number;
  reward: number;
}

export const QUEST_POOL: QuestDef[] = [
  {
    id: 'play_any',
    title: 'Play a game together',
    emoji: '🎮',
    icon: 'gamepad',
    event: 'game_played',
    target: 1,
    reward: 25,
  },
  { id: 'play_three', title: 'Play 3 games', emoji: '🎲', icon: 'dice', event: 'game_played', target: 3, reward: 45 },
  {
    id: 'play_live',
    title: 'Start a live audio room',
    emoji: '🎧',
    icon: 'mic',
    event: 'live_played',
    target: 1,
    reward: 40,
  },
  {
    id: 'sync_five',
    title: 'Match answers 5 times',
    emoji: '🧠',
    icon: 'sparkles',
    event: 'sync_match',
    target: 5,
    reward: 40,
  },
  { id: 'dare_done', title: 'Complete a dare', emoji: '🔥', icon: 'fire', event: 'dare_done', target: 1, reward: 35 },
  { id: 'quiz_win', title: 'Win a quiz showdown', emoji: '🏆', icon: 'star', event: 'quiz_win', target: 1, reward: 45 },
  {
    id: 'daily_q',
    title: 'Answer today’s question',
    emoji: '💬',
    icon: 'chat',
    event: 'daily_answered',
    target: 1,
    reward: 30,
  },
  {
    id: 'send_moment',
    title: 'Send a moment',
    emoji: '📸',
    icon: 'camera',
    event: 'moment_sent',
    target: 1,
    reward: 30,
  },
];

export const QUESTS_PER_DAY = 3;

function hashString(value: string): number {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Same 3 quests for both partners on any given day. */
export function questsForDate(date: string): QuestDef[] {
  let seed = hashString(date);
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  const pool = [...QUEST_POOL];
  const picked: QuestDef[] = [];
  // Always keep one easy "just play" quest so a quiet day is still winnable.
  const easy = pool.filter((q) => q.id === 'play_any' || q.id === 'daily_q');
  const first = easy[Math.floor(rand() * easy.length)];
  picked.push(first);
  pool.splice(pool.indexOf(first), 1);
  while (picked.length < QUESTS_PER_DAY && pool.length > 0) {
    picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return picked;
}

export interface BadgeDef {
  id: string;
  title: string;
  emoji: string;
  /** App icon, for places that draw icons instead of emoji (Wrapped). */
  icon: IconName;
  hint: string;
  test: (p: CoupleProgress, level: number) => boolean;
}

const stat = (p: CoupleProgress, key: string) => p.stats[key] ?? 0;

export const BADGES: BadgeDef[] = [
  {
    id: 'first_game',
    title: 'First Play',
    emoji: '🎮',
    icon: 'gamepad',
    hint: 'Play your first game',
    test: (p) => stat(p, 'games_played') >= 1,
  },
  {
    id: 'live_first',
    title: 'Going Live',
    emoji: '🎧',
    icon: 'volumeHigh',
    hint: 'Finish a live audio room',
    test: (p) => stat(p, 'live_games') >= 1,
  },
  {
    id: 'ten_games',
    title: 'Regulars',
    emoji: '🎲',
    icon: 'dice',
    hint: 'Play 10 games',
    test: (p) => stat(p, 'games_played') >= 10,
  },
  {
    id: 'streak_3',
    title: 'On a Roll',
    emoji: '🔥',
    icon: 'fire',
    hint: '3-day play streak',
    test: (p) => p.bestStreak >= 3,
  },
  {
    id: 'sync_10',
    title: 'Mind Melders',
    emoji: '🧠',
    icon: 'sparkles',
    hint: 'Match answers 10 times',
    test: (p) => stat(p, 'sync_matches') >= 10,
  },
  {
    id: 'dares_5',
    title: 'Fearless',
    emoji: '😈',
    icon: 'flash',
    hint: 'Complete 5 dares',
    test: (p) => stat(p, 'dares_done') >= 5,
  },
  {
    id: 'truths_10',
    title: 'Open Book',
    emoji: '📖',
    icon: 'journal',
    hint: 'Tell 10 truths',
    test: (p) => stat(p, 'truths_done') >= 10,
  },
  {
    id: 'detective',
    title: 'Mind Reader',
    emoji: '🕵️',
    icon: 'search',
    hint: 'Guess 10 answers right',
    test: (p) => stat(p, 'guesses_correct') >= 10,
  },
  {
    id: 'live_ten',
    title: 'Voice & Vibes',
    emoji: '🎙️',
    icon: 'mic',
    hint: 'Finish 10 live rooms',
    test: (p) => stat(p, 'live_games') >= 10,
  },
  {
    id: 'quiz_ace',
    title: 'Quiz Whiz',
    emoji: '🏆',
    icon: 'star',
    hint: 'Get 25 quiz answers right',
    test: (p) => stat(p, 'quiz_correct') >= 25,
  },
  {
    id: 'streak_7',
    title: 'Week of Play',
    emoji: '⚡',
    icon: 'calendar',
    hint: '7-day play streak',
    test: (p) => p.bestStreak >= 7,
  },
  {
    id: 'level_5',
    title: 'Power Couple',
    emoji: '💎',
    icon: 'diamond',
    hint: 'Reach level 5',
    test: (_p, level) => level >= 5,
  },
  {
    id: 'sync_50',
    title: 'One Brain',
    emoji: '🌀',
    icon: 'heart',
    hint: 'Match answers 50 times',
    test: (p) => stat(p, 'sync_matches') >= 50,
  },
  {
    id: 'fifty_games',
    title: 'Game Night Legends',
    emoji: '🏅',
    icon: 'flag',
    hint: 'Play 50 games',
    test: (p) => stat(p, 'games_played') >= 50,
  },
  {
    id: 'streak_30',
    title: 'Monthly Habit',
    emoji: '👑',
    icon: 'gift',
    hint: '30-day play streak',
    test: (p) => p.bestStreak >= 30,
  },
  {
    id: 'level_10',
    title: 'Elite Duo',
    emoji: '🌟',
    icon: 'sparkles',
    hint: 'Reach level 10',
    test: (_p, level) => level >= 10,
  },
];

export function emptyProgress(date: string): CoupleProgress {
  return {
    xp: 0,
    stats: {},
    badges: [],
    playStreak: 0,
    bestStreak: 0,
    lastPlayDate: null,
    quests: { date, counts: {}, claimed: [], soloIds: [] },
  };
}

/** Local date string (YYYY-MM-DD) — quests and streaks follow the player's own calendar day. */
export function todayKey(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function dayDiff(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime();
  const b = new Date(`${to}T00:00:00`).getTime();
  return Math.round((b - a) / 86_400_000);
}

export interface AwardInput {
  xp: number;
  stats?: Record<string, number>;
  /** Quest events fired, with repeat counts (e.g. `{ sync_match: 4 }`). */
  events?: Record<string, number>;
  /** Solo activity key — rewarded at most once per day. */
  soloId?: string;
}

export interface AwardResult {
  progress: CoupleProgress;
  gainedXp: number;
  levelBefore: number;
  levelAfter: number;
  newBadges: BadgeDef[];
  completedQuests: QuestDef[];
  streakExtended: boolean;
}

/** Fold a reward into the couple's progress: XP, stats, streak, quests, then badges. */
export function applyAward(prev: CoupleProgress, input: AwardInput, today: string = todayKey()): AwardResult {
  const levelBefore = levelFromXp(prev.xp);

  // Reset quest counters on a new day.
  const quests: QuestState =
    prev.quests.date === today
      ? {
          ...prev.quests,
          counts: { ...prev.quests.counts },
          claimed: [...prev.quests.claimed],
          soloIds: [...prev.quests.soloIds],
        }
      : { date: today, counts: {}, claimed: [], soloIds: [] };

  let xp = prev.xp;
  let gained = 0;
  const stats = { ...prev.stats };

  const soloDuplicate = input.soloId ? quests.soloIds.includes(input.soloId) : false;
  if (input.soloId && !soloDuplicate) quests.soloIds.push(input.soloId);
  const effective = soloDuplicate ? { ...input, xp: 0, stats: undefined, events: undefined } : input;

  gained += Math.max(0, Math.round(effective.xp));
  for (const [key, n] of Object.entries(effective.stats ?? {})) stats[key] = (stats[key] ?? 0) + n;
  for (const [event, n] of Object.entries(effective.events ?? {})) {
    quests.counts[event] = (quests.counts[event] ?? 0) + n;
  }

  // Streak counts a day as "played" once anything earns progress.
  let playStreak = prev.playStreak;
  let lastPlayDate = prev.lastPlayDate;
  let streakExtended = false;
  const played = (effective.xp > 0 || Object.keys(effective.stats ?? {}).length > 0) && !soloDuplicate;
  if (played) {
    if (lastPlayDate !== today) {
      const gap = lastPlayDate ? dayDiff(lastPlayDate, today) : Infinity;
      playStreak = gap === 1 ? playStreak + 1 : 1;
      lastPlayDate = today;
      streakExtended = true;
    }
  }
  const bestStreak = Math.max(prev.bestStreak, playStreak);

  // Claim any quests completed by this award.
  const completedQuests: QuestDef[] = [];
  for (const quest of questsForDate(today)) {
    if (quests.claimed.includes(quest.id)) continue;
    if ((quests.counts[quest.event] ?? 0) >= quest.target) {
      quests.claimed.push(quest.id);
      completedQuests.push(quest);
      gained += quest.reward;
    }
  }

  xp += gained;
  const levelAfter = levelFromXp(xp);

  const next: CoupleProgress = {
    xp,
    stats,
    badges: [...prev.badges],
    playStreak,
    bestStreak,
    lastPlayDate,
    quests,
  };

  const newBadges: BadgeDef[] = [];
  for (const badge of BADGES) {
    if (next.badges.includes(badge.id)) continue;
    if (badge.test(next, levelAfter)) {
      next.badges.push(badge.id);
      newBadges.push(badge);
    }
  }

  return {
    progress: next,
    gainedXp: gained,
    levelBefore,
    levelAfter,
    newBadges,
    completedQuests,
    streakExtended,
  };
}

/** Quest progress for display; also rolls a stale day forward without mutating. */
export function questView(progress: CoupleProgress, today: string = todayKey()) {
  const counts = progress.quests.date === today ? progress.quests.counts : {};
  const claimed = progress.quests.date === today ? progress.quests.claimed : [];
  return questsForDate(today).map((quest) => ({
    ...quest,
    count: Math.min(quest.target, counts[quest.event] ?? 0),
    done: claimed.includes(quest.id),
  }));
}

/** A streak that hasn't been played today or yesterday is effectively broken. */
export function activeStreak(progress: CoupleProgress, today: string = todayKey()): number {
  if (!progress.lastPlayDate) return 0;
  return dayDiff(progress.lastPlayDate, today) <= 1 ? progress.playStreak : 0;
}

/** Normalises a stored/remote row of unknown shape into a safe CoupleProgress. */
export function normalizeProgress(raw: unknown, today: string = todayKey()): CoupleProgress {
  const base = emptyProgress(today);
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
  const numMap = (v: unknown): Record<string, number> => {
    if (!v || typeof v !== 'object') return {};
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).filter(
        ([, n]) => typeof n === 'number' && Number.isFinite(n as number),
      ),
    ) as Record<string, number>;
  };
  const strList = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : [];
  const q = (r.quests && typeof r.quests === 'object' ? r.quests : {}) as Record<string, unknown>;
  return {
    xp: Math.max(0, Math.floor(num(r.xp))),
    stats: numMap(r.stats),
    badges: strList(r.badges),
    playStreak: Math.max(0, Math.floor(num(r.play_streak ?? r.playStreak))),
    bestStreak: Math.max(0, Math.floor(num(r.best_streak ?? r.bestStreak))),
    lastPlayDate:
      typeof (r.last_play_date ?? r.lastPlayDate) === 'string' ? String(r.last_play_date ?? r.lastPlayDate) : null,
    quests: {
      date: typeof q.date === 'string' ? q.date : today,
      counts: numMap(q.counts),
      claimed: strList(q.claimed),
      soloIds: strList(q.soloIds),
    },
  };
}
