import type { IconName } from '@/components/ui/Icon';

/**
 * The switches on Settings > Notifications. Each covers one or more notification
 * types; the Worker checks the same map before sending a push
 * (server/src/functions.ts PUSH_CATEGORY), so keep the two in sync.
 */
export const NOTIFICATION_CATEGORIES: { key: string; label: string; icon: IconName; types: string[] }[] = [
  { key: 'messages', label: 'Messages', icon: 'chat', types: ['message', 'message_new'] },
  { key: 'moments', label: 'New moments', icon: 'camera', types: ['moment'] },
  { key: 'moods', label: 'Mood updates', icon: 'happy', types: ['mood', 'mood_update'] },
  { key: 'dailyQuestion', label: 'Daily question', icon: 'question', types: ['challenge'] },
  { key: 'streaks', label: 'Streak reminders', icon: 'fire', types: ['streak'] },
  { key: 'games', label: 'Game invites', icon: 'gamepad', types: ['game_invite', 'game_turn'] },
];

export type NotificationPrefs = Record<string, boolean>;

/** Missing keys count as on. Types outside every category are always allowed. */
export function isNotificationTypeEnabled(prefs: NotificationPrefs | null | undefined, type: string): boolean {
  const category = NOTIFICATION_CATEGORIES.find((c) => c.types.includes(type));
  if (!category) return true;
  return prefs?.[category.key] !== false;
}
