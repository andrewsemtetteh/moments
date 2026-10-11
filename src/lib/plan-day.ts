import { addMinutes, format, isSameDay, max as maxDate, setHours, setMinutes, startOfDay } from 'date-fns';

import { parsePlanMeta } from '@/lib/plan-meta';
import type { CalendarEvent } from '@/types/database';

/** Who a plan belongs to: both of you, or one partner (their user id). */
export type PlanOwner = 'together' | string;
export type OwnerFilter = 'all' | 'together' | 'me' | 'partner';

/** Plans have no end time — assume an hour for "free together". */
const ASSUMED_MINUTES = 60;
/** "Free together" looks at the evening, when couples actually plan things. */
const EVENING_START_HOUR = 17;
const EVENING_END_HOUR = 23;
const MIN_FREE_MINUTES = 60;

export function planOwner(event: CalendarEvent): PlanOwner {
  return parsePlanMeta(event.description).owner ?? 'together';
}

/** A partner's private plan shows to you as just "Busy". */
export function isHiddenFrom(event: CalendarEvent, viewerId: string | undefined) {
  const meta = parsePlanMeta(event.description);
  return !!meta.private && !!meta.owner && meta.owner !== viewerId;
}

export function displayTitle(event: CalendarEvent, viewerId: string | undefined) {
  return isHiddenFrom(event, viewerId) ? 'Busy' : event.title;
}

export function matchesOwnerFilter(
  event: CalendarEvent,
  filter: OwnerFilter,
  meId: string | undefined,
): boolean {
  if (filter === 'all') return true;
  const owner = planOwner(event);
  if (filter === 'together') return owner === 'together';
  if (filter === 'me') return owner === meId;
  return owner !== 'together' && owner !== meId;
}

/**
 * The longest evening window (≥ 1h) with nothing planned by either of you,
 * e.g. "7:30–10 PM". Today it only looks ahead from now. Null when there's
 * no such window.
 */
export function freeTogetherWindow(
  dayEvents: CalendarEvent[],
  day: Date,
  now: Date,
): { start: Date; end: Date; label: string } | null {
  const base = startOfDay(day);
  let windowStart = setHours(base, EVENING_START_HOUR);
  const windowEnd = setHours(base, EVENING_END_HOUR);
  if (isSameDay(day, now)) {
    // Round up to the next half hour.
    const m = now.getMinutes();
    const rounded = setMinutes(now, m <= 30 ? 30 : 60);
    rounded.setSeconds(0, 0);
    windowStart = maxDate([windowStart, rounded]);
  }
  if (windowStart >= windowEnd) return null;

  const busy = dayEvents
    .map((e) => {
      const start = new Date(e.date_time);
      return { start, end: addMinutes(start, ASSUMED_MINUTES) };
    })
    .filter((b) => b.end > windowStart && b.start < windowEnd)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  let best: { start: Date; end: Date } | null = null;
  let cursor = windowStart;
  for (const b of [...busy, { start: windowEnd, end: windowEnd }]) {
    if (b.start > cursor) {
      const gap = (b.start.getTime() - cursor.getTime()) / 60_000;
      if (gap >= MIN_FREE_MINUTES && (!best || gap > (best.end.getTime() - best.start.getTime()) / 60_000)) {
        best = { start: cursor, end: b.start };
      }
    }
    if (b.end > cursor) cursor = b.end;
  }
  if (!best) return null;

  const sameHalf = format(best.start, 'a') === format(best.end, 'a');
  const startLabel = format(best.start, best.start.getMinutes() ? 'h:mm' : 'h') + (sameHalf ? '' : ` ${format(best.start, 'a')}`);
  const endLabel = format(best.end, best.end.getMinutes() ? 'h:mm a' : 'h a');
  return { ...best, label: `${startLabel}–${endLabel}` };
}
