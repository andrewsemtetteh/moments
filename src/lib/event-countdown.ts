import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  format,
  formatDistanceToNow,
  isFuture,
  isPast,
  isToday,
  isTomorrow,
} from 'date-fns';

export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalMs: number;
  isPast: boolean;
  isImminent: boolean;
  isToday: boolean;
  showSeconds: boolean;
}

export function getCountdownParts(dateTime: Date, now = new Date()): CountdownParts {
  const totalMs = dateTime.getTime() - now.getTime();
  if (totalMs <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      totalMs: 0,
      isPast: true,
      isImminent: false,
      isToday: isToday(dateTime),
      showSeconds: false,
    };
  }

  const days = differenceInDays(dateTime, now);
  const hours = differenceInHours(dateTime, now) % 24;
  const minutes = differenceInMinutes(dateTime, now) % 60;
  const seconds = differenceInSeconds(dateTime, now) % 60;
  const imminent = totalMs < 24 * 60 * 60 * 1000;

  return {
    days,
    hours,
    minutes,
    seconds,
    totalMs,
    isPast: false,
    isImminent: imminent,
    isToday: isToday(dateTime),
    showSeconds: imminent,
  };
}

/** Short label for badges; null if past. */
export function formatEventCountdown(dateTime: Date, now = new Date()): string | null {
  const parts = getCountdownParts(dateTime, now);
  if (parts.isPast) return null;
  if (parts.totalMs < 60_000) return 'Starting now';

  if (parts.isToday && parts.isImminent) {
    if (parts.hours === 0) return `in ${parts.minutes}m`;
    return parts.minutes > 0 ? `in ${parts.hours}h ${parts.minutes}m` : `in ${parts.hours}h`;
  }

  if (isTomorrow(dateTime)) return `Tomorrow · ${format(dateTime, 'h:mm a')}`;

  if (parts.days > 0 && parts.days <= 7) {
    return `in ${parts.days} day${parts.days === 1 ? '' : 's'}`;
  }

  if (isFuture(dateTime)) return formatDistanceToNow(dateTime, { addSuffix: true });
  return null;
}

/** Badge text from live countdown parts (includes seconds when imminent). */
export function formatLiveCountdownBadge(parts: CountdownParts, dateTime: Date): string | null {
  if (parts.isPast) return null;
  if (parts.totalMs < 60_000) return 'Starting now';

  if (parts.showSeconds) {
    if (parts.days > 0) return `in ${parts.days}d ${parts.hours}h`;
    if (parts.hours > 0) return `${parts.hours}h ${parts.minutes}m ${parts.seconds}s`;
    return `${parts.minutes}m ${parts.seconds}s`;
  }

  return formatEventCountdown(dateTime);
}

export function eventProgress(createdAt: string, dateTime: Date, now = new Date()): number {
  const start = new Date(createdAt).getTime();
  const end = dateTime.getTime();
  const t = now.getTime();
  if (end <= start || t >= end) return 1;
  if (t <= start) return 0;
  return Math.min(1, Math.max(0, (t - start) / (end - start)));
}
