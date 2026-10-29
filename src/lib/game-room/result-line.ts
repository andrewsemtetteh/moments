import { getGameDefinition, type RoomPlayer, type RoomState } from './types';

/**
 * "Alex won Quiz 7–5. Rematch?": how a game ended, told to the partner by the player `me`
 * (own-time and live games alike). Null until the game has a result.
 */
export function finishedLine(state: RoomState, me: RoomPlayer, partner: RoomPlayer): string | null {
  const result = state.result;
  if (!result) return null;
  const myName = me.name.split(' ')[0] || 'Your partner';
  const title = getGameDefinition(state.game).title;
  if (result.teamGame) {
    return result.syncPct != null
      ? `You and ${myName} finished ${title}: ${result.syncPct}% in sync.`
      : `You and ${myName} finished ${title}.`;
  }
  const mine = state.scores[me.id] ?? 0;
  const theirs = state.scores[partner.id] ?? 0;
  if (result.winnerId === partner.id) return `${title} is over: you beat ${myName} ${theirs}–${mine}.`;
  if (result.winnerId === me.id) return `${myName} won ${title} ${mine}–${theirs}. Rematch?`;
  return `${title} with ${myName} ended in a tie, ${mine}–${theirs}.`;
}
