export function generateId(): string {
  return crypto.randomUUID();
}

/** Invite code letters: no 0/O or 1/I to mix up. 32 of them, so every byte maps evenly. */
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * A new invite code: 8 characters from the secure random source (32^8, about 10^12, so codes
 * can't be guessed). Only the server makes them; the app's join screen takes exactly 8.
 */
export function newInviteCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => INVITE_ALPHABET[b % 32]).join('');
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The id the app chose for a new row (a UUID), or a new one. An app-chosen id makes saving
 * safe to retry: the second try finds the row the first one made instead of adding a copy.
 */
export function clientOrNewId(value: unknown): string {
  return typeof value === 'string' && UUID.test(value) ? value.toLowerCase() : generateId();
}

/**
 * Limits an hourly job's query to one page of couples (`r` is its relationships alias): the
 * page's ids go in as one JSON value, so a page can be any size. No page: every couple.
 */
export function onlyCouples(relIds: string[] | undefined, param: number): { sql: string; binds: unknown[] } {
  return relIds
    ? { sql: ` AND r.id IN (SELECT value FROM json_each(?${param}))`, binds: [JSON.stringify(relIds)] }
    : { sql: '', binds: [] };
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Mirrors the Postgres `user_relationship_ids()` RLS helper: every non-ended relationship the user belongs to. */
export async function relationshipIdsForUser(db: D1Database, userId: string): Promise<string[]> {
  const { results } = await db
    .prepare(`SELECT id FROM relationships WHERE status <> 'ended' AND (user_1_id = ?1 OR user_2_id = ?1)`)
    .bind(userId)
    .all<{ id: string }>();
  return results.map((r) => r.id);
}

/** Throws-as-401-equivalent guard: use in route handlers to enforce relationship membership. */
export async function isRelationshipMember(
  db: D1Database,
  userId: string,
  relationshipId: string,
): Promise<boolean> {
  const row = await db
    .prepare(
      `SELECT 1 FROM relationships WHERE id = ?1 AND status <> 'ended' AND (user_1_id = ?2 OR user_2_id = ?2)`,
    )
    .bind(relationshipId, userId)
    .first();
  return row !== null;
}

export function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

/**
 * Changes a JSON list on a row (reactions, who viewed, who hid it) without losing a change made
 * at the same moment: the write only lands if the value is still what was read, otherwise it's
 * read again and redone. `change` returns the new value, or undefined when nothing changes.
 * The updated row, or null when there's no such row or nothing to change.
 */
export async function updateJsonColumn<T>(
  db: D1Database,
  table: 'moments' | 'messages',
  column: 'reactions' | 'viewed_by' | 'hidden_for',
  id: string,
  fallback: T,
  change: (current: T) => T | undefined,
): Promise<Record<string, unknown> | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const row = await db.prepare(`SELECT ${column} AS v FROM ${table} WHERE id = ?1`).bind(id).first<{ v: string | null }>();
    if (!row) return null;
    const next = change(parseJson<T>(row.v, fallback));
    if (next === undefined) return null;
    const updated = await db
      .prepare(`UPDATE ${table} SET ${column} = ?1 WHERE id = ?2 AND ${column} IS ?3 RETURNING *`)
      .bind(JSON.stringify(next), id, row.v)
      .first<Record<string, unknown>>();
    if (updated) return updated;
  }
  throw new Error(`${table}.${column} kept changing; try again`);
}

/** Reactions after this person taps `emoji`: one reaction per person, a second tap takes it back. */
export function toggleReaction(previous: Record<string, string[]>, userId: string, emoji: string): Record<string, string[]> {
  const had = previous[emoji]?.includes(userId);
  const next: Record<string, string[]> = {};
  for (const [key, users] of Object.entries(previous)) {
    const rest = users.filter((u) => u !== userId);
    if (rest.length) next[key] = rest;
  }
  if (!had) next[emoji] = [...(next[emoji] ?? []), userId];
  return next;
}

/** Adds this person to a JSON list of ids (who viewed, who hid it); undefined when already there. */
export function withUser(list: string[], userId: string): string[] | undefined {
  return list.includes(userId) ? undefined : [...list, userId];
}

/** Builds `SET col = ?n, ...` + bound values for a whitelisted partial update. Booleans become 0/1. */
export function buildUpdate(
  body: Record<string, unknown>,
  allowedFields: readonly string[],
): { setClause: string; values: unknown[] } | null {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const key of allowedFields) {
    if (body[key] === undefined) continue;
    const value = body[key];
    fields.push(`${key} = ?${fields.length + 1}`);
    values.push(typeof value === 'boolean' ? (value ? 1 : 0) : value);
  }

  if (fields.length === 0) return null;
  return { setClause: fields.join(', '), values };
}
