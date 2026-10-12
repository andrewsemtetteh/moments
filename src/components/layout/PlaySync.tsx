import { useRealtimeSubscription } from '@/hooks/queries';

/**
 * One app-wide realtime subscription each for own-time games and Handpicked answers. Screens
 * must not subscribe to these tables themselves: a second subscriber replaces the first, and
 * closing it would silently stop updates for the screen underneath.
 */
export function PlaySync() {
  useRealtimeSubscription('game_sessions');
  useRealtimeSubscription('pack_answers');
  return null;
}
