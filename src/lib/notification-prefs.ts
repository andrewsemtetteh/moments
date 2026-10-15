import type { IconName } from '@/components/ui/Icon';

/**
 * The switches on Settings > Notifications. Each covers one or more notification
 * types; the Worker checks the same map before sending a push
 * (server/src/functions.ts PUSH_CATEGORY), so keep the two in sync.
 */
export const NOTIFICATION_CATEGORIES: { key: string; label: string; detail: string; icon: IconName; types: string[] }[] = [
  { key: 'messages', label: 'Messages', detail: 'When your partner sends you a message', icon: 'chat', types: ['message', 'message_new'] },
  { key: 'moments', label: 'New moments', detail: 'When they share a photo or video', icon: 'camera', types: ['moment'] },
  { key: 'moods', label: 'Mood updates', detail: 'When they log how they’re feeling', icon: 'happy', types: ['mood', 'mood_update'] },
  { key: 'dailyQuestion', label: 'Daily question', detail: 'When they answer today’s question', icon: 'question', types: ['challenge'] },
  { key: 'streaks', label: 'Streak reminders', detail: 'Before your streak runs out', icon: 'fire', types: ['streak'] },
  { key: 'games', label: 'Game invites', detail: 'When they start a game or it’s your turn', icon: 'gamepad', types: ['game_invite', 'game_turn'] },
];

export type NotificationPrefs = Record<string, boolean>;

/** Missing keys count as on. Types outside every category are always allowed. */
export function isNotificationTypeEnabled(prefs: NotificationPrefs | null | undefined, type: string): boolean {
  const category = NOTIFICATION_CATEGORIES.find((c) => c.types.includes(type));
  if (!category) return true;
  return prefs?.[category.key] !== false;
}
