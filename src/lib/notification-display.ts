import { format, isThisWeek, isToday, isYesterday } from 'date-fns';

import type { IconName } from '@/components/ui/Icon';
import type { Notification } from '@/types/database';

export const NOTIFICATION_TYPE_ICON: Record<string, IconName> = {
  moment: 'camera',
  message: 'chat',
  mood: 'heart',
  mood_update: 'heart',
  challenge: 'sparkles',
  streak: 'fire',
  activity: 'gamepad',
  calendar: 'calendar',
  watch_party: 'film',
  watch_party_nudge: 'film',
  watch_party_scheduled: 'calendar',
};

export const NOTIFICATION_TYPE_LABEL: Record<string, string> = {
  moment: 'Moment',
  message: 'Message',
  mood: 'Mood',
  mood_update: 'Mood',
  challenge: 'Daily challenge',
  streak: 'Streak',
  activity: 'Activity',
  calendar: 'Calendar',
  watch_party: 'Watch Together',
  watch_party_nudge: 'Watch Together',
  watch_party_scheduled: 'Watch Together',
};

/** Relative time with minutes / hours — not plain "Today". */
export function formatNotificationTime(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const diffMs = Math.max(0, now - date.getTime());

  if (diffMs < 45_000) return 'Just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? '1 min ago' : `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (isToday(date)) return hours === 1 ? '1 hr ago' : `${hours} hr ago`;

  if (isYesterday(date)) return `Yesterday · ${format(date, 'h:mm a')}`;

  if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, 'EEE · h:mm a');

  if (date.getFullYear() === new Date(now).getFullYear()) return format(date, 'MMM d · h:mm a');

  return format(date, 'MMM d, yyyy · h:mm a');
}

export function notificationSectionTitle(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date, { weekStartsOn: 1 })) return 'This week';
  return 'Earlier';
}

export interface NotificationSection {
  key: string;
  title: string;
  data: Notification[];
}

export function groupNotificationsBySection(items: Notification[]): NotificationSection[] {
  const order: string[] = [];
  const map = new Map<string, Notification[]>();

  for (const item of items) {
    const title = notificationSectionTitle(item.created_at);
    if (!map.has(title)) {
      map.set(title, []);
      order.push(title);
    }
    map.get(title)!.push(item);
  }

  return order.map((title) => ({
    key: title,
    title,
    data: map.get(title) ?? [],
  }));
}
