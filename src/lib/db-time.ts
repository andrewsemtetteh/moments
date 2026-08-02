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

/** True when value looks like a calendar date (YYYY-MM-DD). */
export function isCalendarDateString(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
