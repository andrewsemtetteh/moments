import {
  differenceInCalendarDays,
  format,
  formatDistanceStrict,
  isToday,
  isTomorrow,
  isYesterday,
} from 'date-fns';

import type { CalendarEvent, EventType } from '@/types/database';
import type { IconName } from '@/components/ui/Icon';

export function planCountdownLabel(at: Date, now = new Date()): string {
  const ms = at.getTime() - now.getTime();
  if (ms <= 0) return 'Happening now';
  if (ms < 60 * 60 * 1000) {
    const mins = Math.max(1, Math.round(ms / 60_000));
    return `${mins} min remaining`;
  }
  if (ms < 36 * 60 * 60 * 1000) {
    return `${formatDistanceStrict(at, now)} remaining`;
  }
  const days = differenceInCalendarDays(at, now);
  if (days === 1) return 'Tomorrow';
  return `${days} days left`;
}

export function planWhenLabel(at: Date): string {
  if (isToday(at)) return `Today · ${format(at, 'h:mm a')}`;
  if (isTomorrow(at)) return `Tomorrow · ${format(at, 'h:mm a')}`;
  if (isYesterday(at)) return `Yesterday · ${format(at, 'h:mm a')}`;
  return format(at, 'EEE, MMM d · h:mm a');
}

export function planDayLabel(at: Date): string {
  if (isToday(at)) return 'Today';
  if (isTomorrow(at)) return 'Tomorrow';
  if (isYesterday(at)) return 'Yesterday';
  return format(at, 'EEEE, MMM d');
}

export function isPlanExperience(event: CalendarEvent): boolean {
  return event.type === 'experience' || /\b(trip|travel|flight|getaway)\b/i.test(event.title);
}

export function isPlanBirthday(title: string): boolean {
  return /\bbirthday\b/i.test(title);
}

export function planMarkerIcon(type: EventType, title: string): IconName | null {
  if (type === 'anniversary' || /\banniversary\b/i.test(title)) return 'heart';
  if (type === 'experience' || /\b(trip|travel|flight|getaway)\b/i.test(title)) return 'airplane';
  if (isPlanBirthday(title)) return 'gift';
  return null;
}

export function planTypeEmoji(type: EventType, title: string): string {
  if (isPlanBirthday(title)) return '🎂';
  if (type === 'anniversary') return '❤️';
  if (type === 'experience' || /\b(trip|travel|flight|getaway)\b/i.test(title)) return '✈';
  if (type === 'reminder') return '📝';
  if (type === 'date') return '🍝';
  return '📌';
}

/** Hero / timeline cover gradients by type — no photo required. */
export function planCoverGradient(type: EventType): [string, string, string] {
  switch (type) {
    case 'date':
      return ['#3A1F28', '#8B2942', '#FF6B8A'];
    case 'anniversary':
      return ['#2A1810', '#8B5A2B', '#E5B567'];
    case 'experience':
      return ['#0F1F2E', '#1E4D6B', '#53BDEB'];
    case 'reminder':
      return ['#14241C', '#2F6B4F', '#46C98B'];
    default:
      return ['#1A1A22', '#3A3A48', '#A0A0AD'];
  }
}
