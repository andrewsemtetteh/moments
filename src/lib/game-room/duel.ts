import { backend } from '@/lib/backend';
import { todayKey } from '@/lib/play-progress';
import { encodeAttachment } from '@/lib/chat-attachments';
import { sendMessage, sendPartnerNotification } from '@/services/api';
import { usePlayProgressStore } from '@/stores/play-progress-store';

import { DUEL_QUESTIONS } from './duel-questions';
import { rivalryAward } from './rivalry';
import type { QuizItem, RoomPlayer, RoomResult } from './types';

/**
 * The daily duel: three quick questions a day, the same three for both of you. Each answers on
 * their own; nothing is shown until you've both answered, then the winner counts towards your
 * head-to-head record and this month's season. A duel stays open until the end of the next day.
 *
 * Stored as a `game_sessions` row with a fixed id per couple and day, so whichever phone opens it
 * first creates it and the other finds the same one.
 */

export const DUEL_SIZE = 3;
const DUEL_XP = 15;

export interface DuelState {
  kind: 'duel';
  date: string;
  players: RoomPlayer[];
  questions: (QuizItem & { correctIndex: number })[];
  /** Each player's picks, in question order; set once, all three at a time. */
  answers: Record<string, number[]>;
  result: { winnerId: string | null; scores: Record<string, number> } | null;
}

export interface DuelSession {
  id: string;
  relationship_id: string;
  game_type: 'duel';
  state: DuelState;
  status: 'active' | 'completed';
  version: number;
  created_by: string | null;
  updated_at: string;
  created_at: string;
}

export function duelId(relationshipId: string, date: string) {
  return `duel_${relationshipId}_${date}`;
}

/** The day before `date` (YYYY-MM-DD, local). */
export function dayBefore(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function seeded(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The day's three questions. Each couple walks the whole bank in their own shuffled order, three
 * a day, so nothing repeats until the bank has been used up.
 */
export function duelQuestions(relationshipId: string, date: string): DuelState['questions'] {
  const rand = seeded(hash(relationshipId));
  const order = DUEL_QUESTIONS.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const day = Math.floor(new Date(`${date}T12:00:00Z`).getTime() / 86_400_000);
  const start = (day * DUEL_SIZE) % order.length;
  return Array.from({ length: DUEL_SIZE }, (_, k) => {
    const q = DUEL_QUESTIONS[order[(start + k) % order.length]];
    return { kind: 'quiz' as const, question: q.question, options: q.options, correctIndex: q.correctIndex };
  });
}

export function newDuel(relationshipId: string, date: string, players: RoomPlayer[]): DuelState {
  return { kind: 'duel', date, players, questions: duelQuestions(relationshipId, date), answers: {}, result: null };
}

/** One point per right answer; the higher score wins, level is a tie. */
export function scoreDuel(state: DuelState): NonNullable<DuelState['result']> {
  const scores: Record<string, number> = {};
  for (const p of state.players) {
    const picks = state.answers[p.id] ?? [];
    scores[p.id] = state.questions.filter((q, i) => picks[i] === q.correctIndex).length;
  }
  const [a, b] = state.players;
  const winnerId = scores[a.id] === scores[b.id] ? null : scores[a.id] > scores[b.id] ? a.id : b.id;
  return { winnerId, scores };
}

/** Your answers in; scored once both of you have answered. Unchanged if you'd already answered. */
export function submitDuel(state: DuelState, playerId: string, picks: number[]): DuelState {
  if (!state.players.some((p) => p.id === playerId) || state.answers[playerId]) return state;
  if (picks.length !== state.questions.length) return state;
  if (picks.some((p, i) => !Number.isInteger(p) || p < 0 || p >= state.questions[i].options.length)) return state;
  const next: DuelState = { ...state, answers: { ...state.answers, [playerId]: picks } };
  const done = next.players.every((p) => next.answers[p.id]);
  return done ? { ...next, result: scoreDuel(next) } : next;
}

/** Whether the duel from `date` can still be played today (its own day and the day after). */
export function duelOpen(date: string, today: string = todayKey()): boolean {
  return date === today || date === dayBefore(today);
}

export async function getDuel(id: string): Promise<DuelSession | null> {
  const { data, error } = await backend.from('game_sessions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  const row = data as DuelSession | null;
  return row && row.state?.kind === 'duel' ? row : null;
}

/** Today's duel, created on first look (the fixed id means you both land on the same one). */
export async function ensureDuel(
  relationshipId: string,
  me: RoomPlayer,
  partner: RoomPlayer,
  date: string = todayKey(),
): Promise<DuelSession> {
  const id = duelId(relationshipId, date);
  const existing = await getDuel(id);
  if (existing) return existing;
  const state = newDuel(relationshipId, date, [me, partner]);
  const { data, error } = await backend
    .from('game_sessions')
    .insert({
      id,
      relationship_id: relationshipId,
      game_type: 'duel',
      state,
      status: 'active',
      version: 1,
      created_by: me.id,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (!error && data) return data as DuelSession;
  // Your partner opened it at the same moment: theirs is the one.
  const theirs = await getDuel(id);
  if (theirs) return theirs;
  throw error ?? new Error('Couldn’t start today’s duel');
}

/** Lock in your three answers. Returns the saved duel. */
export async function answerDuel(
  id: string,
  me: RoomPlayer,
  partner: RoomPlayer,
  picks: number[],
): Promise<DuelSession> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await getDuel(id);
    if (!current) throw new Error('This duel has ended');
    if (!duelOpen(current.state.date)) throw new Error('This duel has closed');
    const next = submitDuel(current.state, me.id, picks);
    if (next === current.state) return current;

    const finished = !!next.result;
    const { data, error } = await backend
      .from('game_sessions')
      .update({
        state: next,
        version: current.version + 1,
        status: finished ? 'completed' : 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('version', current.version)
      .select();
    if (error) throw error;
    const saved = (data as DuelSession[] | null)?.[0];
    if (!saved) continue; // they answered at the same moment: re-read and try again

    const first = (n: string) => n.split(' ')[0];
    // The same news as a card in your chat, worded for you both (it opens the duel).
    const postCard = (status: 'turn' | 'finished', line: string) =>
      void sendMessage(
        saved.relationship_id,
        me.id,
        encodeAttachment({
          type: 'game',
          kind: 'duel',
          id: next.date,
          title: 'Today’s duel',
          emoji: '⚔️',
          status,
          line,
        }),
      ).catch(() => undefined);
    if (finished && next.result) {
      award(saved, next.result);
      const winner = next.result.winnerId;
      const line =
        winner === me.id
          ? `${first(me.name)} won today’s duel. Tap to see the answers.`
          : winner
            ? 'You won today’s duel! Tap to see the answers.'
            : 'Today’s duel is a tie. Tap to see the answers.';
      const mine = next.result.scores[me.id] ?? 0;
      const theirs = next.result.scores[partner.id] ?? 0;
      postCard(
        'finished',
        winner === me.id
          ? `${first(me.name)} won ${mine}–${theirs}.`
          : winner
            ? `${first(partner.name)} won ${theirs}–${mine}.`
            : `A tie at ${mine} each.`,
      );
      void sendPartnerNotification(saved.relationship_id, partner.id, 'game_turn', line, { relatedId: id }).catch(
        () => undefined,
      );
    } else {
      postCard('turn', `${first(me.name)} played. Your turn: three questions, ${first(partner.name)}.`);
      void sendPartnerNotification(
        saved.relationship_id,
        partner.id,
        'game_turn',
        `${first(me.name)} played today’s duel. Your turn: three questions.`,
        { relatedId: id },
      ).catch(() => undefined);
    }
    return saved;
  }
  throw new Error('Your partner is answering too. Try again.');
}

/** The second answer finishes the duel, and that phone awards it (once, for you both). */
function award(session: DuelSession, result: NonNullable<DuelState['result']>) {
  const roomResult: RoomResult = {
    winnerId: result.winnerId,
    teamGame: false,
    headline: '',
    highlights: [],
    xp: DUEL_XP,
  };
  const rivalry = rivalryAward('quiz', roomResult, session.state.date.slice(0, 7));
  void usePlayProgressStore
    .getState()
    .award(
      session.relationship_id,
      { xp: DUEL_XP, stats: { duels_played: 1, games_played: 1, ...rivalry.stats }, events: { game_played: 1 } },
      'Daily duel',
    );
}
