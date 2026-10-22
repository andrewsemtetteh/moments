import { describe, expect, it } from 'vitest';

import { createRoom, itemIndex, MAX_ROUNDS, needsMoreItems, reduceRoom, statsFromRoom, UNLIMITED_ROUNDS } from './reducer';
import type { GameItem, LiveGameKind, RoomState } from './types';

const A = { id: 'a', name: 'Ada' };
const B = { id: 'b', name: 'Ben' };

function startedRoom(game: LiveGameKind, items: GameItem[], rounds = 3, pool = null as RoomState['pool']) {
  let s = createRoom({ id: 'r1', hostId: A.id, players: [A, B], game });
  s = reduceRoom(s, { t: 'configure', game, vibe: 'playful', rounds }, A.id, 0);
  s = reduceRoom(s, { t: 'begin' }, A.id, 0);
  s = reduceRoom(s, { t: 'loaded', items, pool }, A.id, 1_000);
  return s;
}

const choice = (a: string, b: string): GameItem => ({ kind: 'choice', a, b });

describe('fair scoring', () => {
  it('gives no speed bonus on your own time, however long apart you answer', () => {
    let s = createRoom({ id: 'p', hostId: A.id, players: [A, B], game: 'quiz', mode: 'async' });
    s = reduceRoom(s, { t: 'configure', game: 'quiz', vibe: 'playful', rounds: 1 }, A.id, 0);
    s = reduceRoom(s, { t: 'begin' }, A.id, 0);
    s = reduceRoom(s, { t: 'loaded', items: [{ kind: 'quiz', question: 'q', options: ['x', 'y'], correctIndex: 0 }] }, A.id, 0);
    s = reduceRoom(s, { t: 'answer', value: '0' }, A.id, 0);
    s = reduceRoom(s, { t: 'answer', value: '0' }, B.id, 3_600_000);
    expect(s.scores).toEqual({ a: 10, b: 10 });
  });

  it('never rewards the judge in Guess My Answer, and accepts an exact match by itself', () => {
    const prompt: GameItem = { kind: 'prompt', text: 'Favourite food?' };
    let s = startedRoom('guessAnswer', [prompt, prompt], 2);
    const writer = s.turnId!;
    const guesser = writer === A.id ? B.id : A.id;
    s = reduceRoom(s, { t: 'write', text: 'Pizza!' }, writer);
    const judged = reduceRoom(reduceRoom(s, { t: 'guess', value: 'sushi' }, guesser), { t: 'judge', verdict: 'no' }, writer);
    expect(judged.scores[writer]).toBe(0);
    const exact = reduceRoom(s, { t: 'guess', value: ' pizza ' }, guesser);
    expect(exact.step).toBe('reveal');
    expect(exact.verdict).toBe('yes');
    expect(exact.scores[guesser]).toBe(2);
  });
});

describe('versus extras', () => {
  const quiz = (correctIndex: number): GameItem => ({ kind: 'quiz', question: 'q', options: ['w', 'x', 'y', 'z'], correctIndex });

  function quizRoom(doubleFinal: boolean) {
    let s = createRoom({ id: 'q', hostId: A.id, players: [A, B], game: 'quiz' });
    s = reduceRoom(s, { t: 'configure', game: 'quiz', vibe: 'playful', rounds: 2, doubleFinal }, A.id, 0);
    s = reduceRoom(s, { t: 'begin' }, A.id, 0);
    return reduceRoom(s, { t: 'loaded', items: [quiz(0), quiz(1)] }, A.id, 1_000);
  }

  it('scores the comeback round double only when chosen', () => {
    for (const doubleFinal of [false, true]) {
      let s = quizRoom(doubleFinal);
      s = reduceRoom(s, { t: 'answer', value: '0' }, A.id, 1_000);
      s = reduceRoom(s, { t: 'answer', value: '3' }, B.id, 1_000);
      const first = s.scores.a;
      s = reduceRoom(s, { t: 'next' }, A.id, 2_000);
      s = reduceRoom(s, { t: 'answer', value: '1' }, A.id, 2_000);
      s = reduceRoom(s, { t: 'answer', value: '1' }, B.id, 2_000);
      expect(s.roundPoints.a).toBe(doubleFinal ? first * 2 : first);
    }
  });

  it('only the quiz keeps the comeback round', () => {
    const s = createRoom({ id: 'x', hostId: A.id, players: [A, B] });
    expect(reduceRoom(s, { t: 'configure', game: 'thisOrThat', vibe: 'sweet', rounds: 5, doubleFinal: true }, A.id).doubleFinal).toBe(false);
  });

  it('lets the loser pick the next game, and a rematch go straight back in', () => {
    let s = quizRoom(false);
    s = reduceRoom(s, { t: 'answer', value: '0' }, A.id, 1_000);
    s = reduceRoom(s, { t: 'answer', value: '3' }, B.id, 1_000);
    s = reduceRoom(s, { t: 'end' }, A.id, 1_500);
    expect(s.result?.winnerId).toBe('a');

    const lobby = reduceRoom(s, { t: 'rematch' }, B.id);
    expect(lobby.phase).toBe('lobby');
    expect(lobby.picker).toBe('b');
    expect(reduceRoom(lobby, { t: 'suggest', game: 'twoTruths' }, A.id).game).toBe('quiz');
    const picked = reduceRoom(lobby, { t: 'suggest', game: 'twoTruths' }, B.id);
    expect(picked.game).toBe('twoTruths');
    expect(picked.picker).toBeNull();

    const again = reduceRoom(s, { t: 'rematch', again: true }, A.id);
    expect(again.phase).toBe('loading');
    expect(again.game).toBe('quiz');
  });
});

describe('game room reducer', () => {
  it('only the host can configure and begin', () => {
    const s = createRoom({ id: 'r', hostId: A.id, players: [A, B] });
    expect(reduceRoom(s, { t: 'begin' }, B.id).phase).toBe('lobby');
    expect(reduceRoom(s, { t: 'begin' }, A.id).phase).toBe('loading');
    const cfg = reduceRoom(s, { t: 'configure', game: 'quiz', vibe: 'deep', rounds: 99 }, A.id);
    expect(cfg.game).toBe('quiz');
    // Custom counts go up to MAX_ROUNDS.
    expect(cfg.totalRounds).toBe(MAX_ROUNDS);
  });

  it('runs unlimited rounds: keeps going past the loaded questions, tops up, and ends when stopped', () => {
    let s = startedRoom('thisOrThat', [choice('1', '2'), choice('3', '4')], UNLIMITED_ROUNDS);
    expect(s.endless).toBe(true);
    // Two loaded, two or fewer left: time to fetch more.
    expect(needsMoreItems(s)).toBe(true);
    for (let i = 0; i < 3; i++) {
      s = reduceRoom(s, { t: 'answer', value: 'a' }, A.id, 2_000);
      s = reduceRoom(s, { t: 'answer', value: 'a' }, B.id, 2_000);
      s = reduceRoom(s, { t: 'next' }, A.id, 2_000);
    }
    // Past the last loaded question it's still playing, looping round them.
    expect(s.phase).toBe('playing');
    expect(s.round).toBe(3);
    expect(itemIndex(s)).toBe(1);
    // A top-up adds only new questions.
    s = reduceRoom(s, { t: 'more', items: [choice('1', '2'), choice('9', '10')] }, A.id, 2_000);
    expect(s.items).toHaveLength(3);
    // Stopping finishes it, counting the rounds actually played.
    s = reduceRoom(s, { t: 'end' }, A.id, 2_000);
    expect(s.phase).toBe('finished');
    expect(s.result?.highlights?.[0]).toContain('/3 rounds');
  });

  it('keeps Unlimited off for a game picked afterwards', () => {
    let s = startedRoom('thisOrThat', [choice('1', '2')], UNLIMITED_ROUNDS);
    s = reduceRoom(s, { t: 'end' }, A.id, 2_000);
    s = reduceRoom(s, { t: 'rematch' }, A.id, 2_000);
    // Both pick the next game (a team game has no loser to choose it).
    s = reduceRoom(s, { t: 'suggest', game: 'quiz' }, A.id, 2_000);
    s = reduceRoom(s, { t: 'suggest', game: 'quiz' }, B.id, 2_000);
    expect(s.game).toBe('quiz');
    expect(s.endless).toBe(false);
  });

  it('ignores actions from strangers', () => {
    const s = startedRoom('thisOrThat', [choice('x', 'y')]);
    expect(reduceRoom(s, { t: 'answer', value: 'a' }, 'zzz')).toBe(s);
  });

  it('reveals a match and builds a streak with a bonus on the third', () => {
    let s = startedRoom('thisOrThat', [choice('1', '2'), choice('3', '4'), choice('5', '6'), choice('7', '8')], 4);
    const round = () => {
      s = reduceRoom(s, { t: 'answer', value: 'a' }, A.id, 2_000);
      expect(s.step).toBe('answer');
      s = reduceRoom(s, { t: 'answer', value: 'a' }, B.id, 2_500);
      expect(s.step).toBe('reveal');
    };
    round();
    expect(s.scores).toEqual({ a: 1, b: 1 });
    s = reduceRoom(s, { t: 'next' }, B.id, 3_000);
    round();
    s = reduceRoom(s, { t: 'next' }, A.id, 3_000);
    round();
    expect(s.streak).toBe(3);
    expect(s.scores.a).toBe(1 + 1 + 2);
    expect(s.tally.sync_matches).toBe(3);
  });

  it('resets the streak on a mismatch and rejects double answers', () => {
    let s = startedRoom('wouldYouRather', [choice('1', '2'), choice('3', '4')], 2);
    s = reduceRoom(s, { t: 'answer', value: 'a' }, A.id, 2_000);
    const again = reduceRoom(s, { t: 'answer', value: 'b' }, A.id, 2_100);
    expect(again.answers.a).toBe('a');
    s = reduceRoom(s, { t: 'answer', value: 'b' }, B.id, 2_200);
    expect(s.streak).toBe(0);
    expect(s.scores).toEqual({ a: 0, b: 0 });
  });

  it('rejects invalid answers', () => {
    const s = startedRoom('whosLikely', [{ kind: 'prompt', text: 'Who is messier?' }]);
    expect(reduceRoom(s, { t: 'answer', value: 'nope' }, A.id).answers).toEqual({});
    expect(reduceRoom(s, { t: 'answer', value: B.id }, A.id).answers.a).toBe(B.id);
  });

  it('finishes after the last round with a team result', () => {
    let s = startedRoom('thisOrThat', [choice('1', '2')], 1);
    s = reduceRoom(s, { t: 'answer', value: 'b' }, A.id, 2_000);
    s = reduceRoom(s, { t: 'answer', value: 'b' }, B.id, 2_000);
    s = reduceRoom(s, { t: 'next' }, A.id, 2_000);
    expect(s.phase).toBe('finished');
    expect(s.result?.teamGame).toBe(true);
    expect(s.result?.xp).toBeGreaterThan(0);
    expect(statsFromRoom(s)).toMatchObject({ games_played: 1, live_games: 1, sync_matches: 1 });
  });

  it('scores quiz answers with a speed bonus and handles timeouts', () => {
    const q: GameItem = { kind: 'quiz', question: '2+2?', options: ['3', '4', '5'], correctIndex: 1 };
    let s = startedRoom('quiz', [q, q], 2);
    expect(s.deadline).toBe(16_000);
    s = reduceRoom(s, { t: 'answer', value: '1' }, A.id, 1_000);
    s = reduceRoom(s, { t: 'timeout' }, A.id, 20_000);
    expect(s.step).toBe('reveal');
    expect(s.answers.b).toBe('-1');
    expect(s.scores.a).toBeGreaterThanOrEqual(10);
    expect(s.scores.b).toBe(0);
    expect(reduceRoom(s, { t: 'timeout' }, B.id, 20_000)).toBe(s);
  });

  it('runs a truth or dare turn with rating bonus', () => {
    let s = startedRoom('truthDare', [], 2, { truth: ['T1', 'T2'], dare: ['D1'] });
    expect(s.step).toBe('choose');
    expect(s.turnId).toBe(A.id);
    expect(reduceRoom(s, { t: 'pickKind', kind: 'dare' }, B.id).step).toBe('choose');
    s = reduceRoom(s, { t: 'pickKind', kind: 'dare' }, A.id);
    expect(s.current).toEqual({ kind: 'dare', text: 'D1' });
    s = reduceRoom(s, { t: 'perform', done: true }, A.id);
    expect(s.step).toBe('rate');
    expect(reduceRoom(s, { t: 'rate', up: true }, A.id).step).toBe('rate');
    s = reduceRoom(s, { t: 'rate', up: true }, B.id);
    expect(s.scores.a).toBe(3);
    s = reduceRoom(s, { t: 'next' }, B.id);
    expect(s.turnId).toBe(B.id);
    expect(s.step).toBe('choose');
  });

  it('runs guess-my-answer with a judge verdict', () => {
    let s = startedRoom('guessAnswer', [{ kind: 'prompt', text: 'Fav snack?' }], 2);
    expect(s.step).toBe('write');
    s = reduceRoom(s, { t: 'write', text: '  chips ' }, A.id);
    expect(s.secret?.text).toBe('chips');
    expect(reduceRoom(s, { t: 'guess', value: 'x' }, A.id).step).toBe('guess');
    s = reduceRoom(s, { t: 'guess', value: 'popcorn' }, B.id);
    expect(s.step).toBe('judge');
    s = reduceRoom(s, { t: 'judge', verdict: 'yes' }, A.id);
    expect(s.scores).toEqual({ a: 0, b: 2 }); // only the guesser scores
    expect(s.tally.guesses_correct).toBe(1);
  });

  it('runs two truths and a lie', () => {
    let s = startedRoom('twoTruths', [], 2);
    const bad = reduceRoom(s, { t: 'write', statements: ['a', '', 'c'], lie: 1 }, A.id);
    expect(bad.step).toBe('write');
    s = reduceRoom(s, { t: 'write', statements: ['x', 'y', 'z'], lie: 2 }, A.id);
    expect(s.step).toBe('guess');
    const fooled = reduceRoom(s, { t: 'guess', value: '0' }, B.id);
    expect(fooled.scores).toEqual({ a: 2, b: 0 });
    const busted = reduceRoom(s, { t: 'guess', value: '2' }, B.id);
    expect(busted.scores).toEqual({ a: 0, b: 2 });
  });

  it('ends early, crowns a winner and supports rematch', () => {
    let s = startedRoom('truthDare', [], 4, { truth: ['t'], dare: ['d'] });
    s = reduceRoom(s, { t: 'pickKind', kind: 'truth' }, A.id);
    s = reduceRoom(s, { t: 'perform', done: true }, A.id);
    s = reduceRoom(s, { t: 'rate', up: false }, B.id);
    s = reduceRoom(s, { t: 'end' }, A.id);
    expect(s.phase).toBe('finished');
    expect(s.result?.winnerId).toBe(A.id);
    // Either player can ask for another game (the loser then picks).
    expect(reduceRoom(s, { t: 'rematch' }, B.id).phase).toBe('lobby');
    const again = reduceRoom(s, { t: 'rematch' }, A.id);
    expect(again.phase).toBe('lobby');
    expect(again.scores).toEqual({ a: 0, b: 0 });
  });

  it('returns to the lobby with a message when content fails to load', () => {
    let s = createRoom({ id: 'r', hostId: A.id, players: [A, B] });
    s = reduceRoom(s, { t: 'begin' }, A.id);
    s = reduceRoom(s, { t: 'loadFailed', message: 'nope' }, A.id);
    expect(s.phase).toBe('lobby');
    expect(s.message).toBe('nope');
  });
});

describe('own-time (async) rooms', () => {
  function asyncRoom(game: LiveGameKind, items: GameItem[], rounds = 2) {
    let s = createRoom({ id: 'r2', hostId: A.id, players: [A, B], game, mode: 'async' });
    s = reduceRoom(s, { t: 'configure', game, vibe: 'playful', rounds }, A.id, 0);
    s = reduceRoom(s, { t: 'begin' }, A.id, 0);
    return reduceRoom(s, { t: 'loaded', items }, A.id, 1_000);
  }

  it('has no quiz clock', () => {
    const s = asyncRoom('quiz', [{ kind: 'quiz', question: 'q', options: ['x', 'y'], correctIndex: 1 }]);
    expect(s.deadline).toBeNull();
  });

  it('waits for both players before leaving a reveal', () => {
    let s = asyncRoom('thisOrThat', [choice('1', '2'), choice('3', '4')]);
    s = reduceRoom(s, { t: 'answer', value: 'a' }, A.id);
    s = reduceRoom(s, { t: 'answer', value: 'b' }, B.id);
    expect(s.step).toBe('reveal');
    s = reduceRoom(s, { t: 'next' }, A.id);
    expect(s.round).toBe(0);
    expect(s.ready).toEqual({ a: true });
    s = reduceRoom(s, { t: 'next' }, B.id);
    expect(s.round).toBe(1);
    expect(s.step).toBe('answer');
    expect(s.ready).toEqual({});
  });

  it('lets either player end the game', () => {
    const s = asyncRoom('thisOrThat', [choice('1', '2')]);
    expect(reduceRoom(s, { t: 'end' }, B.id).phase).toBe('finished');
  });
});

describe('lobby suggestions', () => {
  it('selects a game once both players suggest it', () => {
    let s = createRoom({ id: 'r3', hostId: A.id, players: [A, B] });
    s = reduceRoom(s, { t: 'suggest', game: 'truthDare' }, B.id);
    expect(s.game).toBe('wouldYouRather');
    expect(s.suggestions).toEqual({ b: 'truthDare' });
    s = reduceRoom(s, { t: 'suggest', game: 'truthDare' }, A.id);
    expect(s.game).toBe('truthDare');
    expect(s.suggestions).toEqual({});
  });
});
