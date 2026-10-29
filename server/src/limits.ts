import { ApiError } from './core';

/**
 * The most each kind of thing can hold, so no one can fill the database (or slow everyone's
 * queries) with one giant row. Far above anything the app sends.
 */
export const MAX_CHARS = {
  message: 4000,
  moment: 2000,
  mood: 40,
  emoji: 32,
  url: 2048,
  kind: 64,
  pushToken: 256,
  dedupKey: 200,
} as const;

/** Ids in one "mark these read" call (D1 binds at most 100 values per statement). */
export const MAX_IDS = 90;
/** Rows in one /db insert. */
export const MAX_ROWS_PER_INSERT = 50;
/** Any other text (or JSON) value written through /db. */
export const MAX_DB_VALUE_CHARS = 50_000;

/** Per-table caps on /db writes, tighter than the general one. */
const DB_COLUMN_CHARS: Record<string, Record<string, number>> = {
  messages: { content: MAX_CHARS.message, media_url: MAX_CHARS.url, media_type: MAX_CHARS.kind },
  moments: { content: MAX_CHARS.moment, media_url: MAX_CHARS.url, type: MAX_CHARS.kind },
  mood_logs: { mood: MAX_CHARS.mood },
};

/** `value` when it's text of at most `max` characters (or missing); a 400 otherwise. */
export function checkText(value: unknown, max: number, what: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new ApiError(`${what} must be text`, 400);
  if (value.length > max) throw new ApiError(`${what} is too long`, 400);
  return value;
}

/** A list of ids, capped. */
export function checkIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  if (value.length > MAX_IDS) throw new ApiError('Too many items at once', 400);
  return value.map((v) => String(v).slice(0, 64));
}

/** Every value a /db insert or update would write, within its cap. */
export function checkDbValues(table: string, values: Record<string, unknown>) {
  const caps = DB_COLUMN_CHARS[table] ?? {};
  for (const [col, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    const size = typeof value === 'string' ? value.length : typeof value === 'object' ? JSON.stringify(value).length : 0;
    if (size > (caps[col] ?? MAX_DB_VALUE_CHARS)) throw new ApiError(`${col} is too long`, 400, '22001');
  }
}
