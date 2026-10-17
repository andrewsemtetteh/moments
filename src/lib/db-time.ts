/** Parse DB timestamptz safely (treat missing offset as UTC). */
export function parseDbTimestampMs(iso: string): number {
  if (!iso) return NaN;
  const trimmed = iso.trim();
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(trimmed);
  const normalized = hasZone ? trimmed : `${trimmed}Z`;
  return new Date(normalized).getTime();
}

/** YYYY-MM-DD in the device's local timezone (midnight local = new day). */
export function localCalendarDate(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * "Today" for the two of you (today's question, the gratitude swap): the calendar day where
 * the person who made the space lives. Partners in different time zones used to be on
 * different days for part of the day, each seeing a different question.
 */
export function spaceCalendarDate(date = new Date()): string {
  try {
    // Lazy: the stores import modules that import this one.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAuthStore, useRelationshipStore } = require('@/stores') as typeof import('@/stores');
    const me = useAuthStore.getState().user;
    const { relationship, partner } = useRelationshipStore.getState();
    // The space's maker is user_1: if that's me, my own day; if it's my partner, theirs.
    if (!relationship || !me || relationship.user_1_id === me.id || !partner) return localCalendarDate(date);
    const timeZone = partner.timezone?.trim();
    if (!timeZone) return localCalendarDate(date);
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    return localCalendarDate(date);
  }
}

/** True when value looks like a calendar date (YYYY-MM-DD). */
export function isCalendarDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
