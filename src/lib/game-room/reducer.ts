import {
  getGameDefinition,
  QUIZ_ANSWER_MS,
  type GameItem,
  type LiveGameKind,
  type RoomAction,
  type RoomPlayer,
  type RoomResult,
  type RoomState,
  type Vibe,
} from './types';

/**
 * Pure, host-authoritative game logic. The host runs `reduceRoom` for every action (its own and
 * the guest's) and broadcasts the resulting state — so neither phone can drift out of sync.
 */

const BLANK_ROUND = {
  answers: {},
  answerAt: {},
  secret: null,
  verdict: null,
  rating: null,
  performed: null,
  current: null,
  roundPoints: {},
  message: null,
  deadline: null,
} satisfies Partial<RoomState>;

export function createRoom(input: {
  id: string;
  hostId: string;
  players: RoomPlayer[];
  game?: LiveGameKind;
  vibe?: Vibe;
}): RoomState {
  const game = input.game ?? 'wouldYouRather';
  return {
    v: 1,
    id: input.id,
    game,
    vibe: input.vibe ?? 'playful',
    topic: '',
    phase: 'lobby',
    hostId: input.hostId,
    players: input.players,
    totalRounds: getGameDefinition(game).defaultRounds,
    round: 0,
    step: 'answer',
    items: [],
    pool: null,
    turnId: null,
    scores: Object.fromEntries(input.players.map((p) => [p.id, 0])),
    streak: 0,
    bestStreak: 0,
    tally: {},
    result: null,
    ...BLANK_ROUND,
  };
}

function bump(state: RoomState, patch: Partial<RoomState>): RoomState {
  return { ...state, ...patch, v: state.v + 1 };
}

function isPlayer(state: RoomState, id: string) {
  return state.players.some((p) => p.id === id);
}

function otherPlayer(state: RoomState, id: string): RoomPlayer | undefined {
  return state.players.find((p) => p.id !== id);
}

function nameOf(state: RoomState, id: string | null | undefined) {
  return state.players.find((p) => p.id === id)?.name ?? 'Someone';
}

function tally(state: RoomState, key: string, by = 1): Record<string, number> {
  return { ...state.tally, [key]: (state.tally[key] ?? 0) + by };
}

function addPoints(
  state: RoomState,
  points: Record<string, number>,
): Pick<RoomState, 'scores' | 'roundPoints'> {
  const scores = { ...state.scores };
  const roundPoints = { ...state.roundPoints };
  for (const [id, n] of Object.entries(points)) {
    if (!n) continue;
    scores[id] = (scores[id] ?? 0) + n;
    roundPoints[id] = (roundPoints[id] ?? 0) + n;
  }
  return { scores, roundPoints };
}

function turnFor(state: RoomState, round: number) {
  return state.players[round % state.players.length]?.id ?? null;
}

function startRound(state: RoomState, round: number, now: number): RoomState {
  const base = { ...state, ...BLANK_ROUND, round };
  switch (state.game) {
    case 'quiz':
      return bump(base, { step: 'answer', turnId: null, deadline: now + QUIZ_ANSWER_MS });
    case 'truthDare':
      return bump(base, { step: 'choose', turnId: turnFor(state, round) });
    case 'guessAnswer':
    case 'twoTruths':
      return bump(base, { step: 'write', turnId: turnFor(state, round) });
    default:
      return bump(base, { step: 'answer', turnId: null });
  }
}

function currentItem(state: RoomState): GameItem | undefined {
  return state.items[state.round];
}

function validAnswer(state: RoomState, value: string): boolean {
  const item = currentItem(state);
  switch (state.game) {
    case 'wouldYouRather':
    case 'thisOrThat':
      return value === 'a' || value === 'b';
    case 'whosLikely':
      return isPlayer(state, value);
    case 'quiz': {
      if (item?.kind !== 'quiz') return false;
      const idx = Number(value);
      return Number.isInteger(idx) && idx >= 0 && idx < item.options.length;
    }
    default:
      return false;
  }
}

/** Both players have answered a simultaneous round — score it and flip to the reveal. */
function revealSimultaneous(state: RoomState, now: number): RoomState {
  const [p1, p2] = state.players;
  const a1 = state.answers[p1.id];
  const a2 = state.answers[p2.id];

  if (state.game === 'quiz') {
    const item = currentItem(state);
    const points: Record<string, number> = {};
    let correctCount = 0;
    let agreeBonus = false;
    if (item?.kind === 'quiz') {
      for (const p of state.players) {
        const ans = state.answers[p.id];
        if (item.correctIndex !== undefined) {
          if (ans !== undefined && Number(ans) === item.correctIndex) {
            const remaining = Math.max(0, (state.deadline ?? now) - (state.answerAt[p.id] ?? now));
            points[p.id] = 10 + Math.round((5 * remaining) / QUIZ_ANSWER_MS);
            correctCount += 1;
          }
        } else if (a1 !== undefined && a1 === a2 && a1 !== '-1') {
          points[p.id] = 5;
          agreeBonus = true;
        }
      }
    }
    const patch = addPoints(state, points);
    return bump(state, {
      ...patch,
      step: 'reveal',
      deadline: null,
      tally: tally(state, 'quiz_correct', correctCount),
      message:
        item?.kind === 'quiz' && item.correctIndex === undefined
          ? agreeBonus
            ? 'Great minds! ✨'
            : 'Different answers 😅'
          : correctCount === 2
            ? 'Both nailed it! 🎯'
            : correctCount === 1
              ? 'One point of glory 👀'
              : 'Nobody got it 😬',
    });
  }

  const match = a1 !== undefined && a1 === a2;
  const streak = match ? state.streak + 1 : 0;
  const bonus = match && streak >= 3 ? 1 : 0;
  const points = match ? { [p1.id]: 1 + bonus, [p2.id]: 1 + bonus } : {};
  const patch = addPoints(state, points);
  return bump(state, {
    ...patch,
    step: 'reveal',
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
    tally: match ? tally(state, 'sync_matches') : state.tally,
    message: match
      ? streak >= 3
        ? `In sync x${streak}! 🔥`
        : 'In sync! ✨'
      : state.game === 'whosLikely'
        ? 'Time to argue your case 🗣️'
        : 'Different brains 😅',
  });
}

function finish(state: RoomState): RoomState {
  const def = getGameDefinition(state.game);
  const [p1, p2] = state.players;
  const s1 = state.scores[p1.id] ?? 0;
  const s2 = state.scores[p2.id] ?? 0;
  const highlights: string[] = [];
  let result: RoomResult;

  if (def.team) {
    const matches = state.tally.sync_matches ?? 0;
    const played = Math.max(1, Math.min(state.totalRounds, state.items.length || state.totalRounds));
    const pct = Math.round((matches / played) * 100);
    highlights.push(`${matches}/${played} rounds in sync (${pct}%)`);
    if (state.bestStreak >= 2) highlights.push(`Best streak: ${state.bestStreak} in a row`);
    result = {
      winnerId: null,
      teamGame: true,
      headline:
        pct >= 80 ? 'Basically one brain 🧠' : pct >= 50 ? 'Nicely in tune 💞' : 'Opposites attract 🧲',
      highlights,
      xp: Math.min(120, 20 + s1 * 4 + state.bestStreak * 3),
    };
  } else {
    const winnerId = s1 === s2 ? null : s1 > s2 ? p1.id : p2.id;
    highlights.push(`${p1.name}: ${s1} pts · ${p2.name}: ${s2} pts`);
    if (state.tally.dares_done) highlights.push(`${state.tally.dares_done} dares completed`);
    if (state.tally.truths_done) highlights.push(`${state.tally.truths_done} truths told`);
    if (state.tally.guesses_correct) highlights.push(`${state.tally.guesses_correct} correct guesses`);
    result = {
      winnerId,
      teamGame: false,
      headline: winnerId ? `${nameOf(state, winnerId)} takes it 🏆` : "It's a tie 🤝",
      highlights,
      xp: Math.min(140, 30 + (s1 + s2) * 2 + (winnerId ? 10 : 0)),
    };
  }

  return bump(state, { ...BLANK_ROUND, phase: 'finished', result, tally: tally(state, 'finished') });
}

function ensurePool(state: RoomState, kind: 'truth' | 'dare'): string {
  const list = state.pool?.[kind] ?? [];
  if (list.length === 0) return kind === 'truth' ? 'Tell your partner something you never told them.' : 'Give your partner a 20-second compliment.';
  const used = state.tally[`td_${kind}`] ?? 0;
  return list[used % list.length];
}

export function reduceRoom(
  state: RoomState,
  action: RoomAction,
  from: string,
  now: number = Date.now(),
): RoomState {
  if (!isPlayer(state, from)) return state;
  const isHost = from === state.hostId;

  switch (action.t) {
    case 'configure': {
      if (!isHost || state.phase !== 'lobby') return state;
      const def = getGameDefinition(action.game);
      const rounds = Math.max(1, Math.min(20, Math.round(action.rounds || def.defaultRounds)));
      return bump(state, {
        game: action.game,
        vibe: action.vibe,
        totalRounds: rounds,
        topic: (action.topic ?? state.topic).slice(0, 80),
      });
    }

    case 'begin':
      if (!isHost || state.phase !== 'lobby' || state.players.length < 2) return state;
      return bump(state, { phase: 'loading', message: null });

    case 'loaded': {
      if (!isHost || state.phase !== 'loading') return state;
      const filled = bump(state, {
        items: action.items,
        pool: action.pool ?? null,
        phase: 'playing',
        scores: Object.fromEntries(state.players.map((p) => [p.id, 0])),
        streak: 0,
        bestStreak: 0,
        tally: {},
        result: null,
      });
      return startRound(filled, 0, now);
    }

    case 'loadFailed':
      if (!isHost || state.phase !== 'loading') return state;
      return bump(state, { phase: 'lobby', message: action.message });

    case 'answer': {
      if (state.phase !== 'playing' || state.step !== 'answer') return state;
      if (!['wouldYouRather', 'thisOrThat', 'whosLikely', 'quiz'].includes(state.game)) return state;
      if (state.answers[from] !== undefined || !validAnswer(state, action.value)) return state;
      const answers = { ...state.answers, [from]: action.value };
      const answerAt = { ...state.answerAt, [from]: now };
      const next = bump(state, { answers, answerAt });
      return state.players.every((p) => answers[p.id] !== undefined)
        ? revealSimultaneous(next, now)
        : next;
    }

    case 'timeout': {
      if (!isHost || state.game !== 'quiz' || state.step !== 'answer') return state;
      const answers = { ...state.answers };
      for (const p of state.players) if (answers[p.id] === undefined) answers[p.id] = '-1';
      return revealSimultaneous(bump(state, { answers }), now);
    }

    case 'pickKind': {
      if (state.game !== 'truthDare' || state.step !== 'choose' || from !== state.turnId) return state;
      const text = ensurePool(state, action.kind);
      return bump(state, {
        current: { kind: action.kind, text },
        step: 'perform',
        tally: tally(state, `td_${action.kind}`),
      });
    }

    case 'perform': {
      if (state.game !== 'truthDare' || state.step !== 'perform' || from !== state.turnId) return state;
      if (!action.done) {
        return bump(state, { performed: 'skipped', step: 'reveal', message: 'Skipped — no points, no shame 😌' });
      }
      const kind = state.current?.kind ?? 'truth';
      return bump(state, {
        ...addPoints(state, { [from]: 2 }),
        performed: 'done',
        step: 'rate',
        tally: tally(state, kind === 'truth' ? 'truths_done' : 'dares_done'),
      });
    }

    case 'rate': {
      if (state.game !== 'truthDare' || state.step !== 'rate' || from === state.turnId) return state;
      const turn = state.turnId;
      return bump(state, {
        ...(action.up && turn ? addPoints(state, { [turn]: 1 }) : {}),
        rating: action.up ? 'up' : 'down',
        step: 'reveal',
        message: action.up ? `${nameOf(state, from)} approved 👏` : `${nameOf(state, from)} wasn't convinced 😏`,
      });
    }

    case 'write': {
      if (state.step !== 'write' || from !== state.turnId) return state;
      if (state.game === 'guessAnswer') {
        const text = (action.text ?? '').trim().slice(0, 140);
        if (!text) return state;
        return bump(state, { secret: { text }, step: 'guess' });
      }
      if (state.game === 'twoTruths') {
        const statements = (action.statements ?? []).map((s) => s.trim().slice(0, 140));
        const lie = action.lie;
        if (statements.length !== 3 || statements.some((s) => !s)) return state;
        if (lie === undefined || lie < 0 || lie > 2) return state;
        return bump(state, { secret: { statements, lie }, step: 'guess' });
      }
      return state;
    }

    case 'guess': {
      if (state.step !== 'guess' || from === state.turnId) return state;
      if (state.game === 'guessAnswer') {
        const value = action.value.trim().slice(0, 140);
        if (!value) return state;
        return bump(state, { answers: { ...state.answers, [from]: value }, step: 'judge' });
      }
      if (state.game === 'twoTruths') {
        const idx = Number(action.value);
        if (![0, 1, 2].includes(idx) || !state.turnId) return state;
        const correct = idx === state.secret?.lie;
        return bump(state, {
          ...addPoints(state, correct ? { [from]: 2 } : { [state.turnId]: 2 }),
          answers: { ...state.answers, [from]: String(idx) },
          step: 'reveal',
          tally: tally(state, correct ? 'guesses_correct' : 'fooled'),
          message: correct ? 'Busted! Sharp eyes 👀' : 'Fooled you! 😈',
        });
      }
      return state;
    }

    case 'judge': {
      if (state.game !== 'guessAnswer' || state.step !== 'judge' || from !== state.turnId) return state;
      const guesser = otherPlayer(state, from)?.id;
      if (!guesser) return state;
      const points =
        action.verdict === 'yes'
          ? { [guesser]: 2, [from]: 1 }
          : action.verdict === 'close'
            ? { [guesser]: 1 }
            : { [from]: 1 };
      return bump(state, {
        ...addPoints(state, points),
        verdict: action.verdict,
        step: 'reveal',
        tally: action.verdict === 'yes' ? tally(state, 'guesses_correct') : state.tally,
        message:
          action.verdict === 'yes'
            ? 'Mind reader! 🔮'
            : action.verdict === 'close'
              ? 'So close 🤏'
              : 'Not even warm 🥶',
      });
    }

    case 'next': {
      if (state.phase !== 'playing' || state.step !== 'reveal') return state;
      const nextRound = state.round + 1;
      return nextRound >= state.totalRounds ? finish(state) : startRound(state, nextRound, now);
    }

    case 'end':
      if (!isHost || state.phase === 'lobby') return state;
      return finish(state);

    case 'rematch':
      if (!isHost || state.phase !== 'finished') return state;
      return bump(state, {
        ...BLANK_ROUND,
        phase: 'lobby',
        round: 0,
        items: [],
        pool: null,
        turnId: null,
        result: null,
        tally: {},
        streak: 0,
        bestStreak: 0,
        scores: Object.fromEntries(state.players.map((p) => [p.id, 0])),
      });

    default:
      return state;
  }
}

/** Stats deltas folded into the couple's lifetime progress once a room finishes. */
export function statsFromRoom(state: RoomState): Record<string, number> {
  const stats: Record<string, number> = { games_played: 1, live_games: 1 };
  const add = (key: string, n: number | undefined) => {
    if (n) stats[key] = (stats[key] ?? 0) + n;
  };
  add('sync_matches', state.tally.sync_matches);
  add('truths_done', state.tally.truths_done);
  add('dares_done', state.tally.dares_done);
  add('guesses_correct', state.tally.guesses_correct);
  add('quiz_correct', state.tally.quiz_correct);
  if (state.game === 'quiz') add('quiz_games', 1);
  return stats;
}
