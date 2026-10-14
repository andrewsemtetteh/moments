import type { HubEvent } from './hub';
import { generateId, nowIso, relationshipIdsForUser } from './db';
import './env';

export const BOOL_COLUMNS = new Set([
  'is_pinned',
  'deleted_for_all',
  'read',
  'push_dispatched',
  'completed',
  'distance_mode',
  'location_sharing_enabled',
  'show_online_status',
  'is_private',
]);

export const JSON_COLUMNS = new Set([
  'reactions',
  'viewed_by',
  'hidden_for',
  'payload',
  'metadata',
  'questions',
  'responses',
  'scores',
  'stats',
  'badges',
  'quests',
  'mood_summary',
  'highlights',
  'state',
  'notification_prefs',
]);

/** SQLite row -> the JSON shape the app's Postgres-era types expect (booleans, parsed JSON). */
export function shapeRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const [key, value] of Object.entries(out)) {
    if (BOOL_COLUMNS.has(key) && (typeof value === 'number' || value === null)) {
      out[key] = value === 1;
    } else if (JSON_COLUMNS.has(key) && typeof value === 'string') {
      try {
        out[key] = JSON.parse(value);
      } catch {
        /* leave as-is */
      }
    }
  }
  return out as T;
}

/** App value -> SQLite bind value. */
export function toBind(key: string, value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  if (JSON_COLUMNS.has(key) && typeof value === 'string') return value;
  return value;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Realtime fan-out
// ---------------------------------------------------------------------------

export async function emitToRelationship(env: Env, relationshipId: string, event: HubEvent) {
  try {
    const stub = env.HUB.get(env.HUB.idFromName(relationshipId));
    await stub.fetch('https://hub/notify', { method: 'POST', body: JSON.stringify(event) });
  } catch {
    /* realtime is best-effort */
  }
}

/** Emit a row change to whichever relationship rooms should see it. */
export async function emitRow(
  env: Env,
  table: string,
  eventType: HubEvent['eventType'],
  row: Record<string, unknown> | null,
  old: Record<string, unknown> | null = null,
) {
  const shaped = row ? shapeRow(row) : null;
  const shapedOld = old ? shapeRow(old) : null;
  const source = shaped ?? shapedOld;
  if (!source) return;

  const event: HubEvent = { table, eventType, new: shaped, old: shapedOld };
  if (table === 'notifications' && typeof source.user_id === 'string') event.userId = source.user_id;

  if (table === 'users' && typeof source.id === 'string') {
    for (const relId of await relationshipIdsForUser(env.DB, source.id)) {
      await emitToRelationship(env, relId, event);
    }
    return;
  }

  const relId = table === 'relationships' ? source.id : source.relationship_id;
  if (typeof relId === 'string') await emitToRelationship(env, relId, event);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function createPartnerNotification(
  env: Env,
  args: {
    relationshipId: string;
    recipientId: string;
    type: string;
    content: string;
    mediaUrl?: string | null;
    relatedId?: string | null;
  },
): Promise<string | null> {
  if (!args.type.trim() || !args.content.trim()) return null;

  const member = await env.DB.prepare(
    `SELECT 1 FROM relationships WHERE id = ?1 AND status = 'active' AND (user_1_id = ?2 OR user_2_id = ?2)`,
  )
    .bind(args.relationshipId, args.recipientId)
    .first();
  if (!member) return null;

  const id = generateId();
  const row = await env.DB.prepare(
    `INSERT INTO notifications (id, relationship_id, user_id, type, content, media_url, related_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING *`,
  )
    .bind(id, args.relationshipId, args.recipientId, args.type, args.content, args.mediaUrl ?? null, args.relatedId ?? null)
    .first<Record<string, unknown>>();
  if (row) await emitRow(env, 'notifications', 'INSERT', row);
  return id;
}

export async function tryNotificationDedup(env: Env, relationshipId: string, key: string): Promise<boolean> {
  const result = await env.DB.prepare(
    'INSERT OR IGNORE INTO notification_dedup (relationship_id, dedup_key) VALUES (?1, ?2)',
  )
    .bind(relationshipId, key)
    .run();
  return result.meta.changes > 0;
}

export async function partnerOf(env: Env, relationshipId: string, userId: string): Promise<string | null> {
  const rel = await env.DB.prepare(
    `SELECT user_1_id, user_2_id FROM relationships WHERE id = ?1 AND status = 'active'`,
  )
    .bind(relationshipId)
    .first<{ user_1_id: string; user_2_id: string | null }>();
  if (!rel) return null;
  if (rel.user_1_id === userId) return rel.user_2_id;
  if (rel.user_2_id === userId) return rel.user_1_id;
  return null;
}

const MOOD_LABELS: Record<string, string> = { missing: 'Missing you' };

export function moodLabel(mood: string): string {
  const key = mood.toLowerCase();
  if (MOOD_LABELS[key]) return MOOD_LABELS[key];
  const spaced = key.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export async function displayName(env: Env, userId: string): Promise<string> {
  const row = await env.DB.prepare('SELECT name FROM users WHERE id = ?1').bind(userId).first<{ name: string | null }>();
  return row?.name?.trim() || 'Your partner';
}

// ---------------------------------------------------------------------------
// Streaks (port of update_streak / normalize_streak_if_broken / get_streak_status / restore_streak)
// ---------------------------------------------------------------------------

const RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

type StreakRow = {
  id: string;
  relationship_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  user_1_last_active_date: string | null;
  user_2_last_active_date: string | null;
  restorable_streak: number | null;
  restorable_lost_at: string | null;
};

async function ensureStreakRow(env: Env, relationshipId: string): Promise<StreakRow> {
  await env.DB.prepare('INSERT OR IGNORE INTO streaks (id, relationship_id) VALUES (?1, ?2)')
    .bind(generateId(), relationshipId)
    .run();
  return (await env.DB.prepare('SELECT * FROM streaks WHERE relationship_id = ?1')
    .bind(relationshipId)
    .first<StreakRow>())!;
}

async function relationshipMembers(env: Env, relationshipId: string) {
  return env.DB.prepare('SELECT user_1_id, user_2_id, status, subscription_tier FROM relationships WHERE id = ?1')
    .bind(relationshipId)
    .first<{ user_1_id: string; user_2_id: string | null; status: string; subscription_tier: string }>();
}

async function notifyBoth(env: Env, relationshipId: string, type: string, content: string) {
  const rel = await relationshipMembers(env, relationshipId);
  if (!rel) return;
  for (const id of [rel.user_1_id, rel.user_2_id]) {
    if (id) await createPartnerNotification(env, { relationshipId, recipientId: id, type, content });
  }
}

async function normalizeStreakIfBroken(env: Env, relationshipId: string) {
  const row = await ensureStreakRow(env, relationshipId);
  const today = todayStr();

  if (row.last_active_date && row.last_active_date < shiftDay(today, -1) && row.current_streak > 0) {
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE streaks SET restorable_streak = ?1, restorable_lost_at = ?2, current_streak = 0, updated_at = ?2
         WHERE relationship_id = ?3`,
      ).bind(row.current_streak, nowIso(), relationshipId),
      env.DB.prepare('UPDATE relationships SET streak_count = 0 WHERE id = ?1').bind(relationshipId),
    ]);
    if (await tryNotificationDedup(env, relationshipId, `streak_lost:${relationshipId}:${today}`)) {
      await notifyBoth(
        env,
        relationshipId,
        'streak',
        `Your ${row.current_streak}-day streak ended. Plus members can restore it within 24 hours.`,
      );
    }
  }

  const cutoff = new Date(Date.now() - RESTORE_WINDOW_MS).toISOString();
  await env.DB.prepare(
    `UPDATE streaks SET restorable_streak = NULL, restorable_lost_at = NULL
     WHERE relationship_id = ?1 AND current_streak = 0 AND restorable_lost_at IS NOT NULL AND restorable_lost_at <= ?2`,
  )
    .bind(relationshipId, cutoff)
    .run();
}

/** Records qualifying couple activity for `userId` (or both partners when null). */
export async function updateStreak(env: Env, relationshipId: string, userId: string | null) {
  const rel = await relationshipMembers(env, relationshipId);
  if (!rel || rel.status !== 'active') return;
  if (userId && userId !== rel.user_1_id && userId !== rel.user_2_id) return;

  const row = await ensureStreakRow(env, relationshipId);
  const today = todayStr();

  const markUser1 = userId === null || userId === rel.user_1_id;
  const markUser2 = userId === null || userId === rel.user_2_id;
  if (markUser1) row.user_1_last_active_date = today;
  if (markUser2) row.user_2_last_active_date = today;

  let current = row.current_streak;
  let longest = row.longest_streak;
  let last = row.last_active_date;
  let restorable = row.restorable_streak;
  let lostAt = row.restorable_lost_at;

  if (!last || last < shiftDay(today, -1)) {
    current = 1;
    longest = Math.max(longest, 1);
    last = today;
    restorable = null;
    lostAt = null;
  } else if (last === shiftDay(today, -1)) {
    current += 1;
    longest = Math.max(longest, current);
    last = today;
  } else {
    longest = Math.max(longest, current);
  }

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE streaks SET current_streak = ?1, longest_streak = ?2, last_active_date = ?3,
         user_1_last_active_date = ?4, user_2_last_active_date = ?5,
         restorable_streak = ?6, restorable_lost_at = ?7, updated_at = ?8
       WHERE relationship_id = ?9`,
    ).bind(current, longest, last, row.user_1_last_active_date, row.user_2_last_active_date, restorable, lostAt, nowIso(), relationshipId),
    env.DB.prepare('UPDATE relationships SET streak_count = ?1 WHERE id = ?2').bind(current, relationshipId),
  ]);

  if (row.user_1_last_active_date === today || row.user_2_last_active_date === today) {
    await env.DB.prepare('INSERT OR IGNORE INTO streak_active_days (relationship_id, activity_date) VALUES (?1, ?2)')
      .bind(relationshipId, today)
      .run();
  }

  const updated = await env.DB.prepare('SELECT * FROM streaks WHERE relationship_id = ?1')
    .bind(relationshipId)
    .first<Record<string, unknown>>();
  if (updated) await emitRow(env, 'streaks', 'UPDATE', updated);
}

export async function getStreakStatus(env: Env, relationshipId: string, userId: string) {
  await normalizeStreakIfBroken(env, relationshipId);
  const rel = await relationshipMembers(env, relationshipId);
  const row = await ensureStreakRow(env, relationshipId);
  const today = todayStr();

  const atRisk = row.last_active_date === shiftDay(today, -1) && row.current_streak > 0;
  const canRestore =
    row.current_streak === 0 &&
    (row.restorable_streak ?? 0) > 0 &&
    !!row.restorable_lost_at &&
    new Date(row.restorable_lost_at).getTime() > Date.now() - RESTORE_WINDOW_MS;

  if (atRisk && (await tryNotificationDedup(env, relationshipId, `streak_risk:${relationshipId}:${today}`))) {
    await notifyBoth(env, relationshipId, 'streak', `Your ${row.current_streak}-day streak is at risk. Do something together today to keep it alive.`);
  }

  const isUser1 = rel?.user_1_id === userId;
  const mine = isUser1 ? row.user_1_last_active_date : row.user_2_last_active_date;
  const theirs = isUser1 ? row.user_2_last_active_date : row.user_1_last_active_date;

  const { results } = await env.DB.prepare(
    'SELECT activity_date FROM streak_active_days WHERE relationship_id = ?1 ORDER BY activity_date ASC',
  )
    .bind(relationshipId)
    .all<{ activity_date: string }>();

  return {
    relationship_id: relationshipId,
    current_streak: row.current_streak,
    longest_streak: row.longest_streak,
    last_active_date: row.last_active_date,
    at_risk: atRisk,
    both_active_today: row.user_1_last_active_date === today && row.user_2_last_active_date === today,
    user_active_today: mine === today,
    partner_active_today: theirs === today,
    can_restore_streak: canRestore,
    restorable_streak: canRestore ? row.restorable_streak : null,
    restorable_lost_at: canRestore ? row.restorable_lost_at : null,
    active_days: results.map((r) => r.activity_date),
  };
}

export async function restoreStreak(env: Env, relationshipId: string, userId: string) {
  const rel = await relationshipMembers(env, relationshipId);
  if (!rel) throw new ApiError('Relationship not found', 404);
  const { getPlusState } = await import('./billing');
  if (!(await getPlusState(env, relationshipId)).plus) throw new ApiError('Plus required to restore streaks', 403);

  await normalizeStreakIfBroken(env, relationshipId);
  const row = await ensureStreakRow(env, relationshipId);
  if (row.current_streak !== 0 || !row.restorable_streak || row.restorable_streak <= 0) {
    throw new ApiError('No restorable streak available', 400);
  }
  if (!row.restorable_lost_at || new Date(row.restorable_lost_at).getTime() <= Date.now() - RESTORE_WINDOW_MS) {
    throw new ApiError('Restore window expired', 400);
  }

  const restored = row.restorable_streak;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE streaks SET current_streak = ?1, last_active_date = ?2, restorable_streak = NULL, restorable_lost_at = NULL,
         longest_streak = MAX(longest_streak, ?1), updated_at = ?3 WHERE relationship_id = ?4`,
    ).bind(restored, shiftDay(todayStr(), -1), nowIso(), relationshipId),
    env.DB.prepare('UPDATE relationships SET streak_count = ?1 WHERE id = ?2').bind(restored, relationshipId),
  ]);
  return getStreakStatus(env, relationshipId, userId);
}

// ---------------------------------------------------------------------------
// Rate limiting (replaces edge_rate_limits / consume_rate_limit)
// ---------------------------------------------------------------------------

export async function consumeRateLimit(env: Env, bucket: string, maxHits: number, windowSeconds: number) {
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (bucket_key, window_start, hits) VALUES (?1, ?2, 1)
     ON CONFLICT (bucket_key, window_start) DO UPDATE SET hits = hits + 1 RETURNING hits`,
  )
    .bind(bucket, windowStart)
    .first<{ hits: number }>();
  if ((row?.hits ?? 1) > maxHits) throw new ApiError('Too many requests. Please try again later.', 429);
}
