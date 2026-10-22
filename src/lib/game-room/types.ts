/** Live two-player game rooms: state + action types shared by the reducer, manager and UI. */

export type LiveGameKind =
  | 'wouldYouRather'
  | 'thisOrThat'
  | 'whosLikely'
  | 'truthDare'
  | 'guessAnswer'
  | 'twoTruths'
  | 'quiz';

export type Vibe = 'sweet' | 'playful' | 'spicy' | 'deep';

export type RoomPhase = 'lobby' | 'loading' | 'playing' | 'finished';

export type RoundStep =
  | 'answer'
  | 'reveal'
  | 'choose'
  | 'perform'
  | 'rate'
  | 'write'
  | 'guess'
  | 'judge';

export interface RoomPlayer {
  id: string;
  name: string;
}

export interface ChoiceItem {
  kind: 'choice';
  a: string;
  b: string;
}

export interface PromptItem {
  kind: 'prompt';
  text: string;
}

export interface QuizItem {
  kind: 'quiz';
  question: string;
  options: string[];
  correctIndex?: number;
}

export type GameItem = ChoiceItem | PromptItem | QuizItem;

export interface TruthDarePool {
  truth: string[];
  dare: string[];
}

export type Verdict = 'yes' | 'close' | 'no';

export interface RoomResult {
  /** Null when it's a team game or a tie. */
  winnerId: string | null;
  teamGame: boolean;
  headline: string;
  highlights: string[];
  xp: number;
  /** Team games: share of rounds you matched on (0–100). */
  syncPct?: number;
}

export interface RoomState {
  /** Monotonic version so receivers can drop stale broadcasts. */
  v: number;
  id: string;
  game: LiveGameKind;
  vibe: Vibe;
  topic: string;
  phase: RoomPhase;
  hostId: string;
  players: RoomPlayer[];
  totalRounds: number;
  round: number;
  step: RoundStep;
  items: GameItem[];
  pool: TruthDarePool | null;
  /** Current truth/dare text (truthDare only). */
  current: { kind: 'truth' | 'dare'; text: string } | null;
  /** Whose turn / who the round is about (turn-based games). */
  turnId: string | null;
  /** Answers for the current round, keyed by player id. */
  answers: Record<string, string>;
  answerAt: Record<string, number>;
  /** Secret the turn player wrote (guessAnswer text / twoTruths statements + lie). */
  secret: { text?: string; statements?: string[]; lie?: number } | null;
  verdict: Verdict | null;
  rating: 'up' | 'down' | null;
  performed: 'done' | 'skipped' | null;
  scores: Record<string, number>;
  /** Points scored per player in the round that just revealed (for the "+N" pop). */
  roundPoints: Record<string, number>;
  /** Consecutive "in sync" rounds (team games). */
  streak: number;
  bestStreak: number;
  /** Counters that feed badges / XP once the room finishes. */
  tally: Record<string, number>;
  deadline: number | null;
  message: string | null;
  result: RoomResult | null;
  /** Host wall-clock at broadcast time — lets the guest correct for clock skew on deadlines. */
  hostNow?: number;
  /** `async` = played on each person's own time and persisted, no timers; absent = live room. */
  mode?: 'live' | 'async';
  /** Async only: who has moved past the current reveal (the round advances once both have). */
  ready?: Record<string, boolean>;
  /** Lobby game votes; when both players suggest the same game it's selected. */
  suggestions?: Record<string, LiveGameKind>;
  /** Quiz only, chosen before the game: the last round counts double, so whoever's behind can still win. */
  doubleFinal?: boolean;
  /** After a game, the one who lost picks the next game (their pick is set straight away). */
  picker?: string | null;
  /** Unlimited rounds: questions keep coming (topped up as you go) until one of you ends it. */
  endless?: boolean;
}

export type RoomAction =
  | { t: 'configure'; game: LiveGameKind; vibe: Vibe; rounds: number; topic?: string; doubleFinal?: boolean }
  | { t: 'begin' }
  | { t: 'loaded'; items: GameItem[]; pool?: TruthDarePool | null }
  | { t: 'loadFailed'; message: string }
  /** Unlimited rounds: more questions, added as the loaded ones run low. */
  | { t: 'more'; items: GameItem[] }
  | { t: 'answer'; value: string }
  | { t: 'next' }
  | { t: 'pickKind'; kind: 'truth' | 'dare' }
  | { t: 'perform'; done: boolean }
  | { t: 'rate'; up: boolean }
  | { t: 'write'; text?: string; statements?: string[]; lie?: number }
  | { t: 'guess'; value: string }
  | { t: 'judge'; verdict: Verdict }
  | { t: 'timeout' }
  | { t: 'end' }
  /** `again`: straight into the same game; otherwise back to the lobby, where the loser picks. */
  | { t: 'rematch'; again?: boolean }
  | { t: 'suggest'; game: LiveGameKind };

/** Wire protocol on the shared realtime channel. */
export type WireMessage =
  | { kind: 'state'; state: RoomState }
  | { kind: 'action'; from: string; action: RoomAction }
  | { kind: 'reaction'; from: string; emoji: string; id: string }
  | { kind: 'audio'; from: string; signal: AudioSignal }
  | { kind: 'closed'; from: string };

export type AudioSignal =
  | { type: 'ready' }
  | { type: 'offer'; sdp: unknown }
  | { type: 'answer'; sdp: unknown }
  | { type: 'ice'; candidate: unknown };

export interface GameDefinition {
  kind: LiveGameKind;
  title: string;
  emoji: string;
  tagline: string;
  /** Team games score together; competitive games crown a winner. */
  team: boolean;
  defaultRounds: number;
  roundOptions: number[];
  /** Tone key into PLAY_TONES. */
  tone: 'rose' | 'coral' | 'amber' | 'sage' | 'sky' | 'plum' | 'cocoa' | 'teal' | 'berry' | 'slate';
  /** Games where the AI takes a free-form topic from the players. */
  usesTopic?: boolean;
}

export const LIVE_GAMES: GameDefinition[] = [
  {
    kind: 'wouldYouRather',
    title: 'Would You Rather',
    emoji: '🤔',
    tagline: 'Pick in secret. Reveal together.',
    team: true,
    defaultRounds: 8,
    roundOptions: [5, 8, 12],
    tone: 'sky',
  },
  {
    kind: 'thisOrThat',
    title: 'This or That',
    emoji: '⚡',
    tagline: 'Rapid picks. Match to build a streak.',
    team: true,
    defaultRounds: 10,
    roundOptions: [6, 10, 15],
    tone: 'coral',
  },
  {
    kind: 'whosLikely',
    title: "Who's More Likely",
    emoji: '👉',
    tagline: 'Point at each other. Then defend it.',
    team: true,
    defaultRounds: 8,
    roundOptions: [5, 8, 12],
    tone: 'plum',
  },
  {
    kind: 'truthDare',
    title: 'Truth or Dare',
    emoji: '🔥',
    tagline: 'Take turns. Bring the heat.',
    team: false,
    defaultRounds: 6,
    roundOptions: [4, 6, 10],
    tone: 'berry',
  },
  {
    kind: 'guessAnswer',
    title: 'Guess My Answer',
    emoji: '🕵️',
    tagline: 'They answer secretly. You read their mind.',
    team: false,
    defaultRounds: 6,
    roundOptions: [4, 6, 10],
    tone: 'sage',
  },
  {
    kind: 'twoTruths',
    title: 'Two Truths & a Lie',
    emoji: '🤥',
    tagline: 'Fool your partner. Or get fooled.',
    team: false,
    defaultRounds: 4,
    roundOptions: [2, 4, 6],
    tone: 'slate',
  },
  {
    kind: 'quiz',
    title: 'Quiz Showdown',
    emoji: '🏆',
    tagline: 'Pick any topic. Beat the clock.',
    team: false,
    defaultRounds: 8,
    roundOptions: [5, 8, 12],
    tone: 'amber',
    usesTopic: true,
  },
];

export const VIBES: { id: Vibe; label: string; emoji: string; hint: string }[] = [
  { id: 'sweet', label: 'Sweet', emoji: '🥰', hint: 'Warm & wholesome' },
  { id: 'playful', label: 'Playful', emoji: '😜', hint: 'Silly & light' },
  { id: 'spicy', label: 'Spicy', emoji: '🌶️', hint: 'Flirty but tasteful' },
  { id: 'deep', label: 'Deep', emoji: '🌊', hint: 'Meaningful & honest' },
];

export function getGameDefinition(kind: LiveGameKind): GameDefinition {
  return LIVE_GAMES.find((g) => g.kind === kind) ?? LIVE_GAMES[0];
}

export const QUIZ_ANSWER_MS = 15_000;
