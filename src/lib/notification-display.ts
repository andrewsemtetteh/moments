import {
  differenceInCalendarDays,
  format,
  isValid,
  parse,
} from 'date-fns';

import type { IconName } from '@/components/ui/Icon';
import type { Notification } from '@/types/database';

/** Chat belongs in the message tab — not the notifications page inbox. */
export const CHAT_NOTIFICATION_TYPES = new Set(['message', 'message_new']);

export function isInboxNotification(notification: Pick<Notification, 'type'>): boolean {
  return !CHAT_NOTIFICATION_TYPES.has(notification.type);
}

export function filterInboxNotifications<T extends Pick<Notification, 'type'>>(items: T[]): T[] {
  return items.filter(isInboxNotification);
}

export const NOTIFICATION_TYPE_ICON: Record<string, IconName> = {
  moment: 'camera',
  message: 'chat',
  mood: 'heart',
  mood_update: 'heart',
  challenge: 'question',
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
  challenge: "Today's question",
  streak: 'Streak',
  activity: 'Activity',
  calendar: 'Calendar',
  watch_party: 'Watch Together',
  watch_party_nudge: 'Watch Together',
  watch_party_scheduled: 'Watch Together',
};

/**
 * Gmail / Apple Mail style grouping:
 * Today → Yesterday → Previous 7 days → Previous 30 days → by month.
 */
export const NOTIFICATION_SECTION_ORDER = [
  'Today',
  'Yesterday',
  'Previous 7 days',
  'Previous 30 days',
] as const;

export type NotificationSectionTitle = (typeof NOTIFICATION_SECTION_ORDER)[number] | string;

/** Relative timestamp shown on each row. */
export function formatNotificationTime(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const ref = new Date(now);
  const diffMs = Math.max(0, now - date.getTime());

  if (diffMs < 45_000) return 'Just now';

  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return minutes === 1 ? '1 min ago' : `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  const daysAgo = Math.max(0, differenceInCalendarDays(ref, date));

  if (daysAgo === 0) return hours === 1 ? '1 hr ago' : `${hours} hr ago`;

  if (daysAgo === 1) return `${format(date, 'h:mm a')} · Yesterday`;

  if (daysAgo <= 7) return `${format(date, 'h:mm a')} · ${format(date, 'EEE')}`;
  if (daysAgo <= 30) return `${format(date, 'h:mm a')} · ${format(date, 'MMM d')}`;

  if (date.getFullYear() === ref.getFullYear()) return `${format(date, 'h:mm a')} · ${format(date, 'MMM d')}`;

  return `${format(date, 'h:mm a')} · ${format(date, 'MMM d, yyyy')}`;
}

export function notificationSectionTitle(iso: string, now = Date.now()): NotificationSectionTitle {
  const date = new Date(iso);
  const ref = new Date(now);
  const daysAgo = Math.max(0, differenceInCalendarDays(ref, date));

  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  if (daysAgo <= 7) return 'Previous 7 days';
  if (daysAgo <= 30) return 'Previous 30 days';

  return format(date, 'MMMM yyyy');
}

function notificationSectionSortIndex(title: string): number {
  const fixedIndex = NOTIFICATION_SECTION_ORDER.indexOf(
    title as (typeof NOTIFICATION_SECTION_ORDER)[number],
  );
  if (fixedIndex >= 0) return fixedIndex;

  const parsed = parse(title, 'MMMM yyyy', new Date());
  if (isValid(parsed)) {
    return NOTIFICATION_SECTION_ORDER.length + (300_000 - (parsed.getFullYear() * 12 + parsed.getMonth()));
  }

  return 9999;
}

export interface NotificationSection {
  key: string;
  title: string;
  data: Notification[];
}

export function groupNotificationsBySection(items: Notification[]): NotificationSection[] {
  const map = new Map<string, Notification[]>();

  for (const item of items) {
    const title = notificationSectionTitle(item.created_at);
    const bucket = map.get(title) ?? [];
    bucket.push(item);
    map.set(title, bucket);
  }

  const titles = [...map.keys()].sort(
    (a, b) => notificationSectionSortIndex(a) - notificationSectionSortIndex(b),
  );

  return titles.map((title) => ({
    key: title,
    title,
    data: map.get(title) ?? [],
  }));
}
