import { backend } from '@/lib/backend';
import { sendPartnerNotification } from '@/services/api';
import { fetchGameContent } from '@/services/game-content';
import { usePlayProgressStore } from '@/stores/play-progress-store';

import { createRoom, reduceRoom, statsFromRoom } from './reducer';
import {
  getGameDefinition,
  type LiveGameKind,
  type RoomAction,
  type RoomPlayer,
  type RoomState,
  type Vibe,
} from './types';

/**
 * Own-time games: the same RoomState and reducer the live rooms use, persisted in
 * `game_sessions` instead of broadcast. Every move is a compare-and-swap on `version`, so two
 * phones moving at once can't overwrite each other — the loser re-reads and re-applies.
 */

export interface GameSession {
  id: string;
  relationship_id: string;
  game_type: LiveGameKind;
  state: RoomState;
  status: 'active' | 'completed';
  version: number;
  created_by: string | null;
  updated_at: string;
  created_at: string;
}

const MAX_RETRIES = 3;
const NUDGE_EVERY_MS = 30 * 60_000;
const lastNudge = new Map<string, number>();

/** Whether `playerId` is the one the game is waiting on right now. */
export function isWaitingOn(state: RoomState, playerId: string): boolean {
  if (state.phase !== 'playing') return false;
  switch (state.step) {
    case 'answer':
      return state.answers[playerId] === undefined;
    case 'choose':
    case 'perform':
    case 'write':
    case 'judge':
      return state.turnId === playerId;
    case 'rate':
    case 'guess':
      return state.turnId !== playerId;
    case 'reveal':
      return state.mode === 'async' && !state.ready?.[playerId];
    default:
      return false;
  }
}

export async function listActiveSessions(relationshipId: string): Promise<GameSession[]> {
  const { data, error } = await backend
    .from('game_sessions')
    .select('*')
    .eq('relationship_id', relationshipId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(20);
  if (error) throw error;
  return ((data ?? []) as GameSession[]).filter((s) => s.state?.mode === 'async');
}

export async function getSession(id: string): Promise<GameSession | null> {
  const { data, error } = await backend.from('game_sessions').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as GameSession | null) ?? null;
}

export async function startOwnTimeGame(input: {
  relationshipId: string;
  me: RoomPlayer;
  partner: RoomPlayer;
  game: LiveGameKind;
  vibe: Vibe;
  rounds: number;
  topic?: string;
}): Promise<GameSession> {
  const { me, partner, game, vibe, rounds } = input;
  let state = createRoom({
    id: `own_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
    hostId: me.id,
    players: [me, partner],
    game,
    vibe,
    mode: 'async',
  });
  state = reduceRoom(state, { t: 'configure', game, vibe, rounds, topic: input.topic ?? '' }, me.id);
  state = reduceRoom(state, { t: 'begin' }, me.id);

  const content = await fetchGameContent({
    relationshipId: input.relationshipId,
    game,
    vibe,
    count: Math.max(state.totalRounds, 4),
    topic: state.topic,
    names: [me.name, partner.name],
  });
  if (game !== 'twoTruths' && content.items.length === 0 && !content.pool) {
    throw new Error('Couldn’t load rounds. Try again.');
  }
  state = reduceRoom(state, { t: 'loaded', items: content.items, pool: content.pool }, me.id);

  const now = new Date().toISOString();
  const { data, error } = await backend
    .from('game_sessions')
    .insert({
      relationship_id: input.relationshipId,
      game_type: game,
      state,
      status: 'active',
      version: state.v,
      created_by: me.id,
      updated_at: now,
    })
    .select()
    .single();
  if (error || !data) throw error ?? new Error('Couldn’t start the game');
  const session = data as GameSession;

  void notify(session, partner, `${me.name} started ${getGameDefinition(game).title}. Your move!`, true);
  return session;
}

/** Apply one move; returns the saved session (unchanged if the move wasn't allowed). */
export async function applySessionAction(
  sessionId: string,
  action: RoomAction,
  me: RoomPlayer,
  partner: RoomPlayer,
): Promise<GameSession> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const current = await getSession(sessionId);
    if (!current) throw new Error('This game no longer exists');

    const next = reduceRoom(current.state, action, me.id);
    if (next === current.state) return current;

    const finished = next.phase === 'finished';
    const { data, error } = await backend
      .from('game_sessions')
      .update({
        state: next,
        version: current.version + 1,
        status: finished ? 'completed' : 'active',
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('version', current.version)
      .select();
    if (error) throw error;

    const saved = (data as GameSession[] | null)?.[0];
    if (!saved) continue; // partner moved first — re-read and retry against their state

    if (finished && current.state.phase !== 'finished') award(saved);
    else if (isWaitingOn(next, partner.id) && !isWaitingOn(current.state, partner.id)) {
      void notify(saved, partner, `${me.name} played in ${getGameDefinition(next.game).title}. Your move!`);
    }
    return saved;
  }
  throw new Error('Your partner is moving too. Try again.');
}

/** Ends an unfinished game for both players. */
export async function endSession(sessionId: string, me: RoomPlayer, partner: RoomPlayer) {
  return applySessionAction(sessionId, { t: 'end' }, me, partner);
}

function award(session: GameSession) {
  const state = session.state;
  if (!state.result) return;
  const events: Record<string, number> = { game_played: 1 };
  if (state.tally.sync_matches) events.sync_match = state.tally.sync_matches;
  if (state.tally.dares_done) events.dare_done = state.tally.dares_done;
  if (state.game === 'quiz' && state.result.winnerId) events.quiz_win = 1;
  const stats = { ...statsFromRoom(state) };
  delete stats.live_games;
  void usePlayProgressStore
    .getState()
    .award(session.relationship_id, { xp: state.result.xp, stats, events }, 'Game finished');
}

async function notify(session: GameSession, partner: RoomPlayer, content: string, force = false) {
  const now = Date.now();
  if (!force && now - (lastNudge.get(session.id) ?? 0) < NUDGE_EVERY_MS) return;
  lastNudge.set(session.id, now);
  await sendPartnerNotification(session.relationship_id, partner.id, 'game_turn', content, {
    relatedId: session.id,
  }).catch(() => undefined);
}

const MANUAL_NUDGE_EVERY_MS = 10 * 60_000;
const lastManualNudge = new Map<string, number>();

/** A tap on Nudge: pings your partner that it's their move. Returns false while it's still cooling down. */
export async function nudgePartner(session: GameSession, me: RoomPlayer, partner: RoomPlayer): Promise<boolean> {
  const now = Date.now();
  if (now - (lastManualNudge.get(session.id) ?? 0) < MANUAL_NUDGE_EVERY_MS) return false;
  lastManualNudge.set(session.id, now);
  const title = getGameDefinition(session.state.game).title;
  await notify(session, partner, `${me.name.split(' ')[0]} nudged you. It’s your move in ${title}.`, true);
  return true;
}
