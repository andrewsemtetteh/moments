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

/**
 * Title tiers: each covers five levels, ranked I–V (Sweethearts III). Twenty tiers take
 * you to level 100; past that you're Timeless, counting up for as long as you play.
 */
export const TITLE_TIERS = [
  'Sparks Fly',
  'Crushing',
  'Sweethearts',
  'Lovebirds',
  'Partners in Crime',
  'Dream Team',
  'Power Couple',
  'Kindred Spirits',
  'Soulmates',
  'Starcrossed',
  'Moonlit',
  'Golden Hearts',
  'Legends',
  'Icons',
  'Constellation',
  'Evergreen',
  'Infinite',
  'Mythic Duo',
  'Celestial',
  'Eternal',
];

const LEVELS_PER_TIER = 5;
const RANKS = ['I', 'II', 'III', 'IV', 'V'];

/**
 * Cumulative XP needed to *reach* a level (level 1 = 0). Quadratic, with no cap: level 10
 * takes about a month of regular play, level 25 about half a year, level 50 a couple of
 * years, so there is always a next level.
 */
export function xpForLevel(level: number): number {
  const steps = Math.max(1, Math.floor(level)) - 1;
  return 50 * steps * steps + 150 * steps;
}

export function titleForLevel(level: number): string {
  const l = Math.max(1, Math.floor(level));
  const tier = Math.floor((l - 1) / LEVELS_PER_TIER);
  if (tier >= TITLE_TIERS.length) return `Timeless ${l - TITLE_TIERS.length * LEVELS_PER_TIER}`;
  return `${TITLE_TIERS[tier]} ${RANKS[(l - 1) % LEVELS_PER_TIER]}`;
}

export function levelFromXp(xp: number): number {
  // Solve the quadratic, then nudge for rounding.
  const safe = Math.max(0, xp);
  let level = Math.max(1, Math.floor((-150 + Math.sqrt(22500 + 200 * safe)) / 100) + 1);
  while (level > 1 && safe < xpForLevel(level)) level -= 1;
  while (safe >= xpForLevel(level + 1)) level += 1;
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
    icon: 'sync',
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
    id: 'pack_one',
    title: 'Answer a pack question',
    emoji: '💭',
    icon: 'chat',
    event: 'pack_answered',
    target: 1,
    reward: 25,
  },
  {
    id: 'pack_five',
    title: 'Answer 5 pack questions',
    emoji: '📚',
    icon: 'journal',
    event: 'pack_answered',
    target: 5,
    reward: 50,
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
  /** Which ladder it sits on in the trophy room. */
  group: string;
  /** How far up its ladder (1 = first step); drives the trophy's colour. */
  tier: number;
  goal: number;
  /** Where you are towards `goal`. */
  value: (p: CoupleProgress, level: number) => number;
  test: (p: CoupleProgress, level: number) => boolean;
}

const stat = (p: CoupleProgress, key: string) => p.stats[key] ?? 0;

interface Ladder {
  group: string;
  key: string;
  emoji: string;
  icon: IconName;
  value: (p: CoupleProgress, level: number) => number;
  hint: (n: number) => string;
  /** [goal, name, id?] — an explicit id keeps trophies people already earned. */
  steps: [number, string, string?][];
}

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * Every trophy is a step on a ladder, and every ladder keeps going well past the first
 * few weeks (the top steps take years), so there is always a next one in sight.
 */
const LADDERS: Ladder[] = [
  {
    group: 'Games',
    key: 'games',
    emoji: '🎮',
    icon: 'gamepad',
    value: (p) => stat(p, 'games_played'),
    hint: (n) => (n === 1 ? 'Play your first game' : `Play ${plural(n, 'game', 'games')}`),
    steps: [
      [1, 'First Play', 'first_game'],
      [10, 'Regulars', 'ten_games'],
      [25, 'Game Lovers'],
      [50, 'Game Night Legends', 'fifty_games'],
      [100, 'Centurions'],
      [250, 'Board Barons'],
      [500, 'Play Masters'],
      [1000, 'Thousand Club'],
      [2500, 'Grandmasters'],
      [5000, 'Hall of Fame'],
    ],
  },
  {
    group: 'Live rooms',
    key: 'live',
    emoji: '🎧',
    icon: 'mic',
    value: (p) => stat(p, 'live_games'),
    hint: (n) => (n === 1 ? 'Finish a live audio room' : `Finish ${plural(n, 'live room', 'live rooms')}`),
    steps: [
      [1, 'Going Live', 'live_first'],
      [10, 'Voice & Vibes', 'live_ten'],
      [25, 'On Air'],
      [50, 'Prime Time'],
      [100, 'Broadcast Legends'],
      [250, 'Voices of Love'],
      [500, 'Golden Mic'],
    ],
  },
  {
    group: 'Play streak',
    key: 'streak',
    emoji: '🔥',
    icon: 'fire',
    value: (p) => p.bestStreak,
    hint: (n) => `${n}-day play streak`,
    steps: [
      [3, 'On a Roll', 'streak_3'],
      [7, 'Week of Play', 'streak_7'],
      [14, 'Fortnight Flame'],
      [30, 'Monthly Habit', 'streak_30'],
      [60, 'Two Month Glow'],
      [100, 'Hundred Day Fire'],
      [180, 'Half a Year'],
      [365, 'Year-Round'],
      [730, 'Unbreakable'],
    ],
  },
  {
    group: 'In sync',
    key: 'sync',
    emoji: '🧠',
    icon: 'sync',
    value: (p) => stat(p, 'sync_matches'),
    hint: (n) => `Match answers ${plural(n, 'time', 'times')}`,
    steps: [
      [10, 'Mind Melders', 'sync_10'],
      [25, 'Same Wavelength'],
      [50, 'One Brain', 'sync_50'],
      [100, 'Telepathic'],
      [250, 'Twin Flames'],
      [500, 'Hive Mind'],
      [1000, 'One Heartbeat'],
    ],
  },
  {
    group: 'Dares',
    key: 'dares',
    emoji: '😈',
    icon: 'flash',
    value: (p) => stat(p, 'dares_done'),
    hint: (n) => (n === 1 ? 'Complete a dare' : `Complete ${plural(n, 'dare', 'dares')}`),
    steps: [
      [1, 'Daredevil'],
      [5, 'Fearless', 'dares_5'],
      [25, 'Thrill Seekers'],
      [100, 'No Limits'],
      [250, 'Unstoppable'],
    ],
  },
  {
    group: 'Truths',
    key: 'truths',
    emoji: '📖',
    icon: 'journal',
    value: (p) => stat(p, 'truths_done'),
    hint: (n) => (n === 1 ? 'Tell a truth' : `Tell ${plural(n, 'truth', 'truths')}`),
    steps: [
      [1, 'First Truth'],
      [10, 'Open Book', 'truths_10'],
      [50, 'Truth Tellers'],
      [150, 'Glass Hearts'],
      [500, 'Nothing to Hide'],
    ],
  },
  {
    group: 'Guessing',
    key: 'guess',
    emoji: '🕵️',
    icon: 'search',
    value: (p) => stat(p, 'guesses_correct'),
    hint: (n) => `Guess ${plural(n, 'answer', 'answers')} right`,
    steps: [
      [10, 'Mind Reader', 'detective'],
      [50, 'Psychics'],
      [150, 'Crystal Ball'],
      [500, 'Oracle'],
    ],
  },
  {
    group: 'Quizzes',
    key: 'quiz',
    emoji: '🏆',
    icon: 'star',
    value: (p) => stat(p, 'quiz_correct'),
    hint: (n) => `Get ${plural(n, 'quiz answer', 'quiz answers')} right`,
    steps: [
      [25, 'Quiz Whiz', 'quiz_ace'],
      [100, 'Top of the Class'],
      [300, 'Quiz Royalty'],
      [1000, 'Encyclopedia'],
    ],
  },
  {
    group: 'Question of the day',
    key: 'daily',
    emoji: '💬',
    icon: 'chat',
    value: (p) => stat(p, 'daily_answers'),
    hint: (n) => (n === 1 ? 'Answer today’s question' : `Answer ${plural(n, 'daily question', 'daily questions')}`),
    steps: [
      [1, 'First Answer'],
      [7, 'Week of Words'],
      [30, 'Daily Ritual'],
      [100, 'Hundred Days'],
      [365, 'Year of Us'],
      [730, 'Two Years Talking'],
      [1000, 'Storytellers'],
    ],
  },
  {
    group: 'Moments',
    key: 'moments',
    emoji: '📸',
    icon: 'camera',
    value: (p) => stat(p, 'moments_sent'),
    hint: (n) => (n === 1 ? 'Send a moment' : `Send ${plural(n, 'moment', 'moments')}`),
    steps: [
      [1, 'Snapshot'],
      [10, 'Shutterbugs'],
      [50, 'Memory Makers'],
      [200, 'Gallery of Us'],
      [500, 'Living Album'],
      [1000, 'Archive of Love'],
    ],
  },
  {
    group: 'Handpicked answers',
    key: 'packq',
    emoji: '💭',
    icon: 'question',
    value: (p) => stat(p, 'pack_answers'),
    hint: (n) => `Answer ${plural(n, 'Handpicked question', 'Handpicked questions')}`,
    steps: [
      [10, 'Curious'],
      [50, 'Deep Divers'],
      [200, 'Open Books'],
      [500, 'Question Masters'],
      [1000, 'Know It All'],
    ],
  },
  {
    group: 'Sets finished',
    key: 'packs',
    emoji: '📚',
    icon: 'albums',
    value: (p) => stat(p, 'packs_completed'),
    hint: (n) => (n === 1 ? 'Finish a Handpicked set' : `Finish ${plural(n, 'Handpicked set', 'Handpicked sets')}`),
    steps: [
      [1, 'Pack Opener'],
      [5, 'Collectors'],
      [20, 'Completionists'],
      [50, 'Library of Us'],
      [100, 'Every Chapter'],
    ],
  },
  {
    group: 'Done together',
    key: 'together',
    emoji: '🌿',
    icon: 'heart',
    value: (p) => stat(p, 'together_done'),
    hint: (n) => (n === 1 ? 'Do an activity together' : `Do ${plural(n, 'activity', 'activities')} together`),
    steps: [
      [1, 'Doers'],
      [10, 'Adventurers'],
      [30, 'Bucket Listers'],
      [75, 'Life Together'],
      [150, 'Always Up for It'],
    ],
  },
  {
    group: 'Levels',
    key: 'level',
    emoji: '💎',
    icon: 'diamond',
    value: (_p, level) => level,
    hint: (n) => `Reach level ${n}`,
    steps: [
      [5, 'Power Couple', 'level_5'],
      [10, 'Elite Duo', 'level_10'],
      [15, 'Rising Stars'],
      [20, 'Golden Pair'],
      [30, 'Shining'],
      [40, 'Radiant'],
      [50, 'Half Century'],
      [75, 'Living Legends'],
      [100, 'Timeless'],
    ],
  },
];

export const BADGES: BadgeDef[] = LADDERS.flatMap((ladder) =>
  ladder.steps.map(([goal, title, id], index) => ({
    id: id ?? `${ladder.key}_${goal}`,
    title,
    emoji: ladder.emoji,
    icon: ladder.icon,
    hint: ladder.hint(goal),
    group: ladder.group,
    tier: index + 1,
    goal,
    value: ladder.value,
    test: (p: CoupleProgress, level: number) => ladder.value(p, level) >= goal,
  })),
);

/** The trophy groups in order, for the trophy room. */
export const BADGE_GROUPS = LADDERS.map((l) => l.group);

/** The next trophy on each ladder, closest to done first — what to chase next. */
export function nextBadges(progress: CoupleProgress, limit = 6) {
  const level = levelFromXp(progress.xp);
  const owned = new Set(progress.badges);
  const next = BADGE_GROUPS.flatMap((group) => {
    const badge = BADGES.find((b) => b.group === group && !owned.has(b.id));
    if (!badge) return [];
    const value = Math.min(badge.goal, badge.value(progress, level));
    return [{ badge, value, ratio: badge.goal > 0 ? value / badge.goal : 0 }];
  });
  return next.sort((a, b) => b.ratio - a.ratio).slice(0, limit);
}

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
