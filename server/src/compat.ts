import { Hono } from 'hono';

import type { AuthVariables } from './auth';
import {
  ApiError,
  BOOL_COLUMNS,
  JSON_COLUMNS,
  consumeRateLimit,
  createPartnerNotification,
  displayName,
  emitRow,
  getStreakStatus,
  moodLabel,
  partnerOf,
  publicProfile,
  restoreStreak,
  shapeRow,
  toBind,
  tryNotificationDedup,
  updateStreak,
} from './core';
import { clientOrNewId, generateId, isRelationshipMember, newInviteCode, toggleReaction, withFreshInviteCode, updateJsonColumn, withUser, nowIso, parseJson, relationshipIdsForUser } from './db';
import { assertMomentAllowance, stripProtected } from './billing';
import { runFunction } from './functions';
import { normalizeContentType, sniffImageType } from './media-type';
import { isPrivateMediaKey, signedMediaUrl } from './media-sign';
import { joinWithInviteCode, onPaired } from './pairing';
import './env';
import { checkDbValues, checkIds, checkText, MAX_CHARS, MAX_IDS, MAX_ROWS_PER_INSERT } from './limits';
import { profileUpdateError } from './profile-rules';
import { clientIp } from './rate-limit';

/**
 * Supabase-compatible surface for the app: a policy-checked generic table endpoint (`/db`),
 * RPC handlers (`/rpc/:name`), R2 storage (`/storage/*`) and function endpoints (`/fn/:name`).
 * Every rule that used to be a Postgres RLS policy lives in POLICIES below.
 */

type Ctx = { Bindings: Env; Variables: AuthVariables };
export const compat = new Hono<Ctx>();

// ---------------------------------------------------------------------------
// Table policies (port of RLS)
// ---------------------------------------------------------------------------

type Op = 'select' | 'insert' | 'update' | 'delete';
type Scope = 'rel' | 'user' | 'relationships' | 'users' | 'none';

type Policy = {
  scope: Scope;
  ops: Op[];
  /** Column forced to the caller's id on insert. */
  forceMe?: string;
  /** Update/delete only allowed on rows where this column is the caller. */
  owner?: string;
  userCol?: string;
};

const ALL: Op[] = ['select', 'insert', 'update', 'delete'];
const relAll: Policy = { scope: 'rel', ops: ALL };

const POLICIES: Record<string, Policy> = {
  users: { scope: 'users', ops: ['select', 'update'] },
  relationships: { scope: 'relationships', ops: ['select', 'insert', 'update'], forceMe: 'user_1_id' },
  moments: { scope: 'rel', ops: ['select', 'delete'], owner: 'user_id' },
  messages: { scope: 'rel', ops: ALL, forceMe: 'sender_id', owner: 'sender_id' },
  mood_logs: { scope: 'rel', ops: ['select', 'insert'], forceMe: 'user_id' },
  notifications: { scope: 'user', userCol: 'user_id', ops: ['select', 'update', 'delete'] },
  streaks: { scope: 'rel', ops: ['select', 'insert'] },
  streak_active_days: { scope: 'rel', ops: ['select'] },
  activities: relAll,
  calendar_events: relAll,
  bucket_list: relAll,
  shared_goals: relAll,
  journal_entries: relAll,
  wrapped_stats: relAll,
  saved_experiences: relAll,
  game_sessions: relAll,
  pack_answers: { scope: 'rel', ops: ['select', 'insert'], forceMe: 'user_id' },
  quiz_live_sessions: relAll,
  couple_progress: relAll,
  daily_challenges: relAll,
  analytics_events: { scope: 'none', ops: ['insert'], forceMe: 'user_id' },
  experiences: { scope: 'none', ops: ['select'] },
};

/**
 * "Already exists" on save may only match a row by its id, or (couple_progress) by the
 * couple. Any other unique column (e.g. a relationship's invite code) let a save overwrite
 * someone else's row.
 */
const UPSERT_KEYS: Record<string, string[]> = {
  couple_progress: ['relationship_id'],
};

/** Columns a client can never change on an existing row (who it belongs to / who wrote it). */
const IMMUTABLE_COLUMNS = new Set(['id', 'relationship_id', 'user_id', 'sender_id', 'user_1_id', 'user_2_id', 'created_at']);

/** Profile columns only the server writes (identity, referrals, push routing). */
const USER_SERVER_COLUMNS = new Set([
  'email',
  'referral_code',
  'referred_by',
  'expo_push_token',
  'expo_push_token_updated_at',
  'revenuecat_customer_id',
  'revenuecat_subscription_id',
]);

/** Same as MESSAGE_EDIT_WINDOW_MS in the app (src/services/api.ts). */
const MESSAGE_EDIT_WINDOW_MS = 15 * 60_000;

/** The kinds of notification the app sends to a partner (anything else is refused). */
const PARTNER_NOTIFICATION_TYPES = new Set([
  'moment',
  'message',
  'mood',
  'mood_update',
  'challenge',
  'streak',
  'activity',
  'achievement',
  'gratitude',
  'game_invite',
  'game_turn',
  'call',
  'calendar',
  'plus_suggest',
  'plus_unlocked',
]);
/** Per sender: plenty for real use, but no flooding a partner's phone. */
const PARTNER_NOTIFICATIONS_PER_HOUR = 60;
const PARTNER_NOTIFICATION_MAX_CHARS = 300;

/** XP can only grow by a game's worth per save (blocks a client writing itself a huge level). */
const MAX_XP_STEP = 5000;

/** SQL that the *existing* row (on an upsert's conflict) belongs to the caller. */
function ownsExistingRow(table: string, policy: Policy, userId: string, binds: unknown[]): string {
  const p = (v: unknown) => {
    binds.push(v);
    return `?${binds.length}`;
  };
  const parts: string[] = [];
  switch (policy.scope) {
    case 'rel': {
      const u = p(userId);
      parts.push(
        `${table}.relationship_id IN (SELECT id FROM relationships WHERE status <> 'ended' AND (user_1_id = ${u} OR user_2_id = ${u}))`,
      );
      break;
    }
    case 'user':
      parts.push(`${table}.${policy.userCol} = ${p(userId)}`);
      break;
    case 'relationships': {
      const u = p(userId);
      parts.push(`(${table}.user_1_id = ${u} OR ${table}.user_2_id = ${u})`);
      break;
    }
    case 'users':
      parts.push(`${table}.id = ${p(userId)}`);
      break;
    default:
      parts.push('1 = 0');
  }
  if (policy.owner) parts.push(`${table}.${policy.owner} = ${p(userId)}`);
  return parts.join(' AND ');
}

/** What a client may write on a profile or a space (billing + server-only columns removed). */
function cleanProtected(table: string, values: Record<string, unknown>): Record<string, unknown> {
  if (table !== 'users' && table !== 'relationships') return { ...values };
  const out: Record<string, unknown> = stripProtected({ ...values });
  if (table === 'users') for (const k of Object.keys(out)) if (USER_SERVER_COLUMNS.has(k)) delete out[k];
  return out;
}

async function checkProgressStep(env: Env, relationshipId: unknown, nextXp: unknown) {
  if (nextXp === undefined || nextXp === null) return;
  const xp = Number(nextXp);
  if (!Number.isFinite(xp) || xp < 0) throw new ApiError('Invalid progress', 400);
  const current = await env.DB.prepare('SELECT xp FROM couple_progress WHERE relationship_id = ?1')
    .bind(relationshipId)
    .first<{ xp: number }>();
  // A first save can carry progress earned offline before the couple's row existed.
  const step = current ? MAX_XP_STEP : MAX_XP_STEP * 10;
  if (xp > (current?.xp ?? 0) + step) throw new ApiError('Invalid progress', 400);
}

const columnCache = new Map<string, Set<string>>();

async function columnsFor(env: Env, table: string): Promise<Set<string>> {
  const cached = columnCache.get(table);
  if (cached) return cached;
  const { results } = await env.DB.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
  const set = new Set(results.map((r) => r.name));
  columnCache.set(table, set);
  return set;
}

type Filter = { col: string; op: string; val: unknown; negate?: boolean };
type DbRequest = {
  table: string;
  op: Op | 'upsert';
  columns?: string;
  filters?: Filter[];
  or?: Filter[][];
  order?: { col: string; asc: boolean }[];
  limit?: number;
  count?: boolean;
  head?: boolean;
  values?: Record<string, unknown> | Record<string, unknown>[];
  onConflict?: string;
  single?: 'single' | 'maybe' | null;
  returning?: boolean;
};

const IDENT = /^[a-z_][a-z0-9_]*$/;

function scopeClause(policy: Policy, userId: string, binds: unknown[]): string {
  const p = (v: unknown) => {
    binds.push(v);
    return `?${binds.length}`;
  };
  switch (policy.scope) {
    case 'rel': {
      const u = p(userId);
      return `relationship_id IN (SELECT id FROM relationships WHERE status <> 'ended' AND (user_1_id = ${u} OR user_2_id = ${u}))`;
    }
    case 'user':
      return `${policy.userCol} = ${p(userId)}`;
    case 'relationships': {
      const u = p(userId);
      return `(user_1_id = ${u} OR user_2_id = ${u})`;
    }
    case 'users': {
      const u = p(userId);
      return `(id = ${u} OR id IN (
        SELECT user_2_id FROM relationships WHERE user_1_id = ${u} AND user_2_id IS NOT NULL AND status <> 'ended'
        UNION SELECT user_1_id FROM relationships WHERE user_2_id = ${u} AND status <> 'ended'))`;
    }
    default:
      return '1 = 1';
  }
}

function filterSql(f: Filter, cols: Set<string>, binds: unknown[]): string {
  if (!IDENT.test(f.col) || !cols.has(f.col)) throw new ApiError(`Unknown column ${f.col}`, 400, 'PGRST204');
  const p = (v: unknown) => {
    binds.push(toBind(f.col, v));
    return `?${binds.length}`;
  };
  let sql: string;
  switch (f.op) {
    case 'eq':
      sql = `${f.col} = ${p(f.val)}`;
      break;
    case 'neq':
      sql = `${f.col} <> ${p(f.val)}`;
      break;
    case 'gt':
      sql = `${f.col} > ${p(f.val)}`;
      break;
    case 'gte':
      sql = `${f.col} >= ${p(f.val)}`;
      break;
    case 'lt':
      sql = `${f.col} < ${p(f.val)}`;
      break;
    case 'lte':
      sql = `${f.col} <= ${p(f.val)}`;
      break;
    case 'is':
      sql = f.val === null ? `${f.col} IS NULL` : `${f.col} = ${p(f.val)}`;
      break;
    case 'in': {
      const list = Array.isArray(f.val) ? f.val : [];
      if (list.length === 0) return f.negate ? '1 = 1' : '1 = 0';
      if (list.length > MAX_IDS) throw new ApiError('Too many values in one filter', 400);
      sql = `${f.col} IN (${list.map((v) => p(v)).join(', ')})`;
      break;
    }
    default:
      throw new ApiError(`Unsupported operator ${f.op}`, 400);
  }
  return f.negate ? `NOT (${sql})` : sql;
}

/**
 * What the app is told when something fails. Our own errors keep their words; anything from the
 * database is logged here and answered generically, so table and column names never leak.
 */
function dbError(e: unknown) {
  if (e instanceof ApiError) return { message: e.message, code: e.code ?? String(e.status) };
  const raw = e instanceof Error ? e.message : String(e);
  console.error(JSON.stringify({ event: 'db_error', error: raw }));
  if (/UNIQUE constraint/i.test(raw)) return { message: 'That already exists', code: '23505' };
  return { message: 'Something went wrong. Please try again.', code: /no such (table|column)/i.test(raw) ? '42P01' : 'D1_ERROR' };
}

compat.post('/db', async (c) => {
  const userId = c.get('userId');
  const env = c.env;
  try {
    const req = await c.req.json<DbRequest>();
    const policy = POLICIES[req.table];
    if (!policy) throw new ApiError('Unknown table', 404, '42P01');
    const op = req.op === 'upsert' ? 'insert' : req.op;
    if (!policy.ops.includes(op)) throw new ApiError('Not allowed', 403, '42501');

    const cols = await columnsFor(env, req.table);
    const myRelIds = policy.scope === 'rel' || req.table === 'analytics_events' ? await relationshipIdsForUser(env.DB, userId) : [];

    // Someone else's profile (your partner's) comes back without its private columns.
    const shape = (rows: Record<string, unknown>[]) =>
      rows.map((r) => {
        const shaped = shapeRow(r);
        return req.table === 'users' && shaped.id !== userId ? publicProfile(shaped) : shaped;
      });
    const finish = (rows: Record<string, unknown>[], count?: number) => {
      const shaped = shape(rows);
      if (req.single) {
        if (shaped.length === 1) return { data: shaped[0], error: null, count };
        if (shaped.length === 0 && req.single === 'maybe') return { data: null, error: null, count };
        return {
          data: null,
          error: {
            code: shaped.length === 0 ? 'PGRST116' : 'PGRST116',
            message: 'JSON object requested, multiple (or no) rows returned',
            details: shaped.length === 0 ? 'The result contains 0 rows' : `The result contains ${shaped.length} rows`,
          },
          count,
        };
      }
      return { data: shaped, error: null, count };
    };

    // ---- INSERT / UPSERT --------------------------------------------------
    if (op === 'insert') {
      const list = Array.isArray(req.values) ? req.values : req.values ? [req.values] : [];
      if (list.length > MAX_ROWS_PER_INSERT) throw new ApiError('Too many rows at once', 400);
      const inserted: Record<string, unknown>[] = [];
      const replayed: Record<string, unknown>[] = [];
      for (const raw of list) {
        // Plus is granted only by the Superwall webhook.
        const values = cleanProtected(req.table, raw);
        // A couple's streak row starts empty: only the server counts days (no writing yourself
        // a 500-day streak). The app only says which couple it's for.
        if (req.table === 'streaks') for (const k of Object.keys(values)) if (k !== 'relationship_id') delete values[k];
        checkDbValues(req.table, values);
        if (req.table === 'users') {
          const problem = profileUpdateError(values);
          if (problem) throw new ApiError(problem, 400, '23514');
        }
        if (policy.forceMe) values[policy.forceMe] = userId;
        // A new space is always yours alone and waiting: only joining with its code adds a
        // partner and makes it active (join_relationship_by_invite).
        if (req.table === 'relationships') {
          values.user_2_id = null;
          values.status = 'pending';
          // The code is always the server's: one the app picked could be guessed.
          values.invite_code = newInviteCode();
        }
        if (req.table === 'couple_progress') await checkProgressStep(env, values.relationship_id, values.xp);
        if (cols.has('id') && !values.id) values.id = generateId();
        if (cols.has('relationship_id') && typeof values.relationship_id === 'string' && policy.scope === 'rel') {
          if (!myRelIds.includes(values.relationship_id)) throw new ApiError('Not allowed', 403, '42501');
        } else if (policy.scope === 'rel') {
          throw new ApiError('relationship_id is required', 400, '23502');
        }
        if (req.table === 'analytics_events' && typeof values.relationship_id === 'string' && !myRelIds.includes(values.relationship_id)) {
          values.relationship_id = null;
        }
        if (req.table === 'users' && values.id !== userId) throw new ApiError('Not allowed', 403, '42501');

        const keys = Object.keys(values).filter((k) => IDENT.test(k) && cols.has(k));
        const binds = keys.map((k) => toBind(k, values[k]));
        let sql = `INSERT INTO ${req.table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `?${i + 1}`).join(', ')})`;
        // The app chose the id: saving it twice (a retry after a timeout) returns the row the
        // first try made, and doesn't run its side effects (pushes, streak) again.
        const appId = req.op !== 'upsert' && typeof raw.id === 'string' && cols.has('id') ? String(values.id) : null;
        if (appId) sql += ' ON CONFLICT (id) DO NOTHING';
        if (req.op === 'upsert') {
          const allowed = UPSERT_KEYS[req.table] ?? [];
          const conflict = req.onConflict && allowed.includes(req.onConflict) && cols.has(req.onConflict) ? req.onConflict : 'id';
          // Never rewrite who a row belongs to, and only ever update a row that's already yours
          // (the WHERE): matching someone else's row now changes nothing.
          const updates = keys.filter((k) => k !== conflict && !IMMUTABLE_COLUMNS.has(k) && !(req.table === 'relationships' && k === 'status'));
          sql += updates.length
            ? ` ON CONFLICT (${conflict}) DO UPDATE SET ${updates.map((k) => `${k} = excluded.${k}`).join(', ')} WHERE ${ownsExistingRow(req.table, policy, userId, binds)}`
            : ` ON CONFLICT (${conflict}) DO NOTHING`;
        }
        sql += ' RETURNING *';
        const codeAt = req.table === 'relationships' ? keys.indexOf('invite_code') : -1;
        const row =
          codeAt >= 0
            ? // A code another waiting space already has is refused; a fresh one is tried instead.
              await withFreshInviteCode((code) => {
                binds[codeAt] = code;
                return env.DB.prepare(sql).bind(...binds).first<Record<string, unknown>>();
              })
            : await env.DB.prepare(sql).bind(...binds).first<Record<string, unknown>>();
        if (row) inserted.push(row);
        else if (appId) {
          const scopeBinds: unknown[] = [appId];
          const existing = await env.DB.prepare(
            `SELECT * FROM ${req.table} WHERE id = ?1 AND ${scopeClause(policy, userId, scopeBinds)}`,
          )
            .bind(...scopeBinds)
            .first<Record<string, unknown>>();
          if (!existing) throw new ApiError('That id is taken', 409, '23505');
          replayed.push(existing);
        }
      }

      for (const row of inserted) {
        await emitRow(env, req.table, 'INSERT', row);
        await afterInsert(env, req.table, row, userId);
      }
      return c.json(finish([...inserted, ...replayed]));
    }

    // ---- SELECT / UPDATE / DELETE: shared WHERE ---------------------------
    const binds: unknown[] = [];
    const where: string[] = [scopeClause(policy, userId, binds)];
    if (policy.owner && (op === 'update' || op === 'delete')) {
      binds.push(userId);
      where.push(`${policy.owner} = ?${binds.length}`);
    }
    if (req.table === 'users' && op === 'update') {
      binds.push(userId);
      where.push(`id = ?${binds.length}`);
    }
    for (const f of req.filters ?? []) where.push(filterSql(f, cols, binds));
    for (const group of req.or ?? []) {
      if (group.length) where.push(`(${group.map((f) => filterSql(f, cols, binds)).join(' OR ')})`);
    }
    const whereSql = where.join(' AND ');

    if (op === 'select') {
      let selected = '*';
      if (req.columns && req.columns.trim() !== '*' && req.columns.trim() !== '') {
        const wanted = req.columns.split(',').map((s) => s.trim()).filter(Boolean);
        for (const col of wanted) if (!IDENT.test(col) || !cols.has(col)) throw new ApiError(`Unknown column ${col}`, 400, 'PGRST204');
        selected = wanted.join(', ');
      }

      let count: number | undefined;
      if (req.count) {
        const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${req.table} WHERE ${whereSql}`)
          .bind(...binds)
          .first<{ n: number }>();
        count = total?.n ?? 0;
        if (req.head) return c.json({ data: null, error: null, count });
      }

      let sql = `SELECT ${selected} FROM ${req.table} WHERE ${whereSql}`;
      const order = (req.order ?? []).filter((o) => IDENT.test(o.col) && cols.has(o.col));
      if (order.length) sql += ` ORDER BY ${order.map((o) => `${o.col} ${o.asc ? 'ASC' : 'DESC'}`).join(', ')}`;
      // A single row still honours .limit(1) ("newest one"); without a limit, 2 lets us spot duplicates.
      const limit = req.single ? Math.min(req.limit ?? 2, 2) : Math.min(req.limit ?? 1000, 1000);
      sql += ` LIMIT ${Math.max(1, Math.floor(limit))}`;
      const { results } = await env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();
      return c.json(finish(results, count));
    }

    if (op === 'update') {
      const asked = (req.values ?? {}) as Record<string, unknown>;
      if (req.table === 'relationships' && Object.keys(asked).some((k) => k === 'user_1_id' || k === 'user_2_id')) {
        throw new ApiError('Not allowed', 403, '42501');
      }
      const patch = cleanProtected(req.table, asked);
      checkDbValues(req.table, patch);
      // The same checks as PATCH /me (birthday 16+, the gender list), so Settings can't skip them.
      if (req.table === 'users') {
        const problem = profileUpdateError(patch);
        if (problem) throw new ApiError(problem, 400, '23514');
      }
      // Who a row belongs to never changes (moving it into another couple, or making a message
      // look like your partner wrote it).
      for (const k of Object.keys(patch)) if (IMMUTABLE_COLUMNS.has(k)) delete patch[k];

      if (req.table === 'relationships') {
        // A space can be left (ended), never made active from here: only joining does that.
        if ('status' in patch && patch.status !== 'ended') throw new ApiError('Not allowed', 403, '42501');
        if ('invite_code' in patch) {
          // Asking for a code gets a new one from the server, never the app's own.
          patch.invite_code = newInviteCode();
          // A code only for a space still waiting for its partner.
          where.push(`user_2_id IS NULL AND status = 'pending'`);
        }
      }
      // A message's words can only be changed in its first 15 minutes (the app's edit window),
      // plus a minute's grace for a slow connection.
      // ("Delete for everyone" clears the words too, at any age.)
      const deleting = patch.deleted_for_all === true || patch.deleted_for_all === 1;
      if (req.table === 'messages' && 'content' in patch && !deleting) {
        binds.push(new Date(Date.now() - MESSAGE_EDIT_WINDOW_MS - 60_000).toISOString());
        where.push(`created_at >= ?${binds.length}`);
      }
      if (req.table === 'couple_progress' && 'xp' in patch) {
        const target = (req.filters ?? []).find((f) => f.col === 'relationship_id' && f.op === 'eq')?.val;
        if (typeof target !== 'string') throw new ApiError('Invalid progress', 400);
        await checkProgressStep(env, target, patch.xp);
      }

      const keys = Object.keys(patch).filter((k) => IDENT.test(k) && cols.has(k));
      if (keys.length === 0) throw new ApiError('No columns to update', 400);
      const updateWhere = where.join(' AND ');

      const oldRows =
        req.table === 'daily_challenges'
          ? (await env.DB.prepare(`SELECT * FROM daily_challenges WHERE ${updateWhere}`).bind(...binds).all<Record<string, unknown>>()).results
          : [];

      // Today's question: you write your own answer. Your partner's can only be cleared, and
      // only when the question is being swapped (a skipped one).
      if (req.table === 'daily_challenges') {
        for (const old of oldRows) {
          const rel = await env.DB.prepare('SELECT user_1_id FROM relationships WHERE id = ?1')
            .bind(old.relationship_id)
            .first<{ user_1_id: string }>();
          const theirs = rel?.user_1_id === userId ? 'user_2_response' : 'user_1_response';
          if (theirs in patch) {
            const clearing = patch[theirs] === null && old.type === 'skipped';
            if (!clearing) throw new ApiError('Not allowed', 403, '42501');
          }
        }
      }

      const setBinds = keys.map((k) => toBind(k, patch[k]));
      const shifted = updateWhere.replace(/\?(\d+)/g, (_m, n) => `?${Number(n) + setBinds.length}`);
      const sql = `UPDATE ${req.table} SET ${keys.map((k, i) => `${k} = ?${i + 1}`).join(', ')} WHERE ${shifted} RETURNING *`;
      const codeAt = req.table === 'relationships' ? keys.indexOf('invite_code') : -1;
      const { results } =
        codeAt >= 0
          ? // A new code someone else's waiting space already has: try a fresh one.
            await withFreshInviteCode((code) => {
              setBinds[codeAt] = code;
              return env.DB.prepare(sql).bind(...setBinds, ...binds).all<Record<string, unknown>>();
            })
          : await env.DB.prepare(sql).bind(...setBinds, ...binds).all<Record<string, unknown>>();

      for (const row of results) {
        await emitRow(env, req.table, 'UPDATE', row);
        const before = oldRows.find((o) => o.id === row.id) ?? null;
        await afterUpdate(env, req.table, before, row, userId);
      }
      return c.json(finish(results));
    }

    // delete
    const { results } = await env.DB.prepare(`DELETE FROM ${req.table} WHERE ${whereSql} RETURNING *`)
      .bind(...binds)
      .all<Record<string, unknown>>();
    for (const row of results) await emitRow(env, req.table, 'DELETE', null, row);
    return c.json(finish(results));
  } catch (e) {
    return c.json({ data: null, error: dbError(e) });
  }
});

// ---------------------------------------------------------------------------
// Write hooks (replaces Postgres triggers)
// ---------------------------------------------------------------------------

async function afterInsert(env: Env, table: string, row: Record<string, unknown>, userId: string) {
  const relId = row.relationship_id;
  if (typeof relId !== 'string') return;

  // Daily check-ins that keep your streak: a moment, a mood, your answer to today's
  // question (below), or playing (record_play_checkin). Chat messages and journal entries don't count.
  if (table === 'moments') {
    await updateStreak(env, relId, userId);
  } else if (table === 'mood_logs') {
    await updateStreak(env, relId, userId);
    await notifyMood(env, relId, userId, String(row.mood ?? ''));
  }
}

async function notifyMood(env: Env, relId: string, userId: string, mood: string) {
  const partner = await partnerOf(env, relId, userId);
  if (!partner || !mood) return;
  const name = await displayName(env, userId);
  await createPartnerNotification(env, {
    relationshipId: relId,
    recipientId: partner,
    type: 'mood',
    content: `${name} is feeling ${moodLabel(mood)}`,
  });
}

async function afterUpdate(
  env: Env,
  table: string,
  before: Record<string, unknown> | null,
  row: Record<string, unknown>,
  _userId: string,
) {
  if (table !== 'daily_challenges' || !before) return;
  const relId = String(row.relationship_id);

  const rel = await env.DB.prepare('SELECT user_1_id, user_2_id FROM relationships WHERE id = ?1')
    .bind(relId)
    .first<{ user_1_id: string; user_2_id: string | null }>();
  if (!rel) return;

  const newly1 = !before.user_1_response && !!row.user_1_response;
  const newly2 = !before.user_2_response && !!row.user_2_response;
  const both = !!row.user_1_response && !!row.user_2_response;

  // Answering today's question is your check-in (each of you, for your own streak).
  if (newly1) await updateStreak(env, relId, rel.user_1_id);
  if (newly2 && rel.user_2_id) await updateStreak(env, relId, rel.user_2_id);

  const responder = newly1 ? rel.user_1_id : newly2 ? rel.user_2_id : null;
  if (!responder) return;
  const partner = await partnerOf(env, relId, responder);
  if (!partner) return;

  const key = `prompt_answer:${row.id}:${responder}:${both ? 'reveal' : 'turn'}`;
  if (!(await tryNotificationDedup(env, relId, key))) return;
  const name = await displayName(env, responder);
  await createPartnerNotification(env, {
    relationshipId: relId,
    recipientId: partner,
    type: 'challenge',
    content: both
      ? `${name} answered today's question. You can both see the answers now.`
      : `${name} answered today's question. Your turn!`,
  });
}

// ---------------------------------------------------------------------------
// RPCs
// ---------------------------------------------------------------------------

type RpcArgs = Record<string, any>;
type RpcHandler = (env: Env, userId: string, args: RpcArgs) => Promise<unknown>;

async function requireMember(env: Env, userId: string, relationshipId: string) {
  if (!relationshipId || !(await isRelationshipMember(env.DB, userId, relationshipId))) {
    throw new ApiError('Relationship not found', 404);
  }
}

async function loadMessage(env: Env, userId: string, messageId: string) {
  const row = await env.DB.prepare('SELECT * FROM messages WHERE id = ?1').bind(messageId).first<Record<string, any>>();
  if (!row) throw new ApiError('Message not found', 404);
  await requireMember(env, userId, row.relationship_id);
  return row;
}

async function saveMessage(env: Env, messageId: string, patch: Record<string, unknown>) {
  const keys = Object.keys(patch);
  const row = await env.DB.prepare(`UPDATE messages SET ${keys.map((k, i) => `${k} = ?${i + 1}`).join(', ')} WHERE id = ?${keys.length + 1} RETURNING *`)
    .bind(...keys.map((k) => toBind(k, patch[k])), messageId)
    .first<Record<string, unknown>>();
  if (row) await emitRow(env, 'messages', 'UPDATE', row);
  return row;
}

/** A reaction: one short emoji, nothing else. */
function checkEmoji(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > MAX_CHARS.emoji) throw new ApiError('Invalid reaction', 400);
  return value;
}


const RPC: Record<string, RpcHandler> = {
  async get_partner_profile(env, userId, a) {
    const row = await env.DB.prepare(
      `SELECT u.* FROM users u WHERE u.id = ?1 AND (u.id = ?2 OR EXISTS (
         SELECT 1 FROM relationships r WHERE r.status <> 'ended'
           AND ((r.user_1_id = ?2 AND r.user_2_id = u.id) OR (r.user_2_id = ?2 AND r.user_1_id = u.id))))`,
    )
      .bind(a.p_user_id, userId)
      .first<Record<string, unknown>>();
    if (!row) return null;
    return row.id === userId ? shapeRow(row) : publicProfile(shapeRow(row));
  },

  async join_relationship_by_invite(env, userId, a) {
    // Invite codes are short: limit guesses (10 per 10 minutes per person).
    await consumeRateLimit(env, `join:${userId}`, 10, 600);
    const target = await joinWithInviteCode(env, userId, a.p_invite_code);
    const joined = await env.DB.prepare('SELECT * FROM relationships WHERE id = ?1').bind(target.relationshipId).first<Record<string, unknown>>();
    if (joined) await emitRow(env, 'relationships', 'UPDATE', joined);
    await onPaired(env, target.relationshipId, userId, target.inviterId);
    return joined ? shapeRow(joined) : null;
  },

  /** A code for my waiting space, made here (never by the app), if it has none yet. */
  async ensure_invite_code(env, userId, a) {
    const row = await withFreshInviteCode((code) =>
      env.DB.prepare(
        `UPDATE relationships SET invite_code = COALESCE(invite_code, ?1)
          WHERE id = ?2 AND user_1_id = ?3 AND user_2_id IS NULL AND status = 'pending' RETURNING *`,
      )
        .bind(code, a.p_relationship_id, userId)
        .first<Record<string, unknown>>(),
    );
    if (!row) throw new ApiError('Space not found', 404);
    return shapeRow(row);
  },

  async set_relationship_anniversary(env, userId, a) {
    await requireMember(env, userId, a.p_relationship_id);
    const row = await env.DB.prepare('UPDATE relationships SET anniversary_date = ?1 WHERE id = ?2 RETURNING *')
      .bind(a.p_anniversary_date, a.p_relationship_id)
      .first<Record<string, unknown>>();
    if (row) await emitRow(env, 'relationships', 'UPDATE', row);
    return row ? shapeRow(row) : null;
  },

  async create_moment(env, userId, a) {
    await requireMember(env, userId, a.p_relationship_id);
    // A retried save (the app's own id): the moment it already made, not a second one.
    const id = clientOrNewId(a.p_id);
    const saved = await env.DB.prepare('SELECT * FROM moments WHERE id = ?1').bind(id).first<Record<string, unknown>>();
    if (saved) {
      if (saved.relationship_id !== a.p_relationship_id || saved.user_id !== userId) throw new ApiError('That id is taken', 409);
      return shapeRow(saved);
    }
    const type = checkText(a.p_type, MAX_CHARS.kind, 'Type') ?? 'photo';
    const content = checkText(a.p_content, MAX_CHARS.moment, 'Caption');
    const mediaUrl = checkText(a.p_media_url, MAX_CHARS.url, 'Media link');
    await assertMomentAllowance(env, a.p_relationship_id, userId);
    // Optional pin for "Our map" — only kept when both are real coordinates.
    const lat = Number(a.p_latitude);
    const lng = Number(a.p_longitude);
    const hasPin =
      a.p_latitude != null && a.p_longitude != null &&
      Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    const row = await env.DB.prepare(
      `INSERT INTO moments (id, relationship_id, user_id, type, content, media_url, latitude, longitude) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
       ON CONFLICT (id) DO NOTHING RETURNING *`,
    )
      .bind(
        id,
        a.p_relationship_id,
        userId,
        type,
        content,
        mediaUrl,
        hasPin ? lat : null,
        hasPin ? lng : null,
      )
      .first<Record<string, unknown>>();
    if (!row) throw new ApiError('Could not create moment');
    await emitRow(env, 'moments', 'INSERT', row);
    await updateStreak(env, a.p_relationship_id, userId);
    return shapeRow(row);
  },

  async mark_moment_viewed(env, userId, a) {
    const moment = await env.DB.prepare('SELECT * FROM moments WHERE id = ?1').bind(a.p_moment_id).first<Record<string, any>>();
    if (!moment) throw new ApiError('Moment not found', 404);
    await requireMember(env, userId, moment.relationship_id);
    if (moment.user_id === userId) return null;
    const row = await updateJsonColumn<string[]>(env.DB, 'moments', 'viewed_by', a.p_moment_id, [], (viewed) => withUser(viewed, userId));
    if (row) await emitRow(env, 'moments', 'UPDATE', row);
    return null;
  },

  async toggle_moment_reaction(env, userId, a) {
    const moment = await env.DB.prepare('SELECT * FROM moments WHERE id = ?1').bind(a.p_moment_id).first<Record<string, any>>();
    if (!moment) throw new ApiError('Moment not found', 404);
    await requireMember(env, userId, moment.relationship_id);
    const emoji = checkEmoji(a.p_emoji);
    const row = await updateJsonColumn<Record<string, string[]>>(env.DB, 'moments', 'reactions', a.p_moment_id, {}, (current) =>
      toggleReaction(current, userId, emoji),
    );
    if (row) await emitRow(env, 'moments', 'UPDATE', row);
    return null;
  },

  async mark_messages_read(env, userId, a) {
    await requireMember(env, userId, a.p_relationship_id);
    const { results } = await env.DB.prepare(
      `UPDATE messages SET read_at = ?1 WHERE relationship_id = ?2 AND sender_id <> ?3 AND read_at IS NULL AND deleted_for_all = 0 RETURNING *`,
    )
      .bind(nowIso(), a.p_relationship_id, userId)
      .all<Record<string, unknown>>();
    for (const row of results) await emitRow(env, 'messages', 'UPDATE', row);
    return null;
  },

  async toggle_message_reaction(env, userId, a) {
    await loadMessage(env, userId, a.p_message_id);
    const emoji = checkEmoji(a.p_emoji);
    const row = await updateJsonColumn<Record<string, string[]>>(env.DB, 'messages', 'reactions', a.p_message_id, {}, (current) =>
      toggleReaction(current, userId, emoji),
    );
    if (row) await emitRow(env, 'messages', 'UPDATE', row);
    return null;
  },

  async set_message_pinned(env, userId, a) {
    await loadMessage(env, userId, a.p_message_id);
    await saveMessage(env, a.p_message_id, { is_pinned: !!a.p_is_pinned, pinned_at: a.p_is_pinned ? nowIso() : null });
    return null;
  },

  async hide_message_for_user(env, userId, a) {
    await loadMessage(env, userId, a.p_message_id);
    const row = await updateJsonColumn<string[]>(env.DB, 'messages', 'hidden_for', a.p_message_id, [], (hidden) => withUser(hidden, userId));
    if (row) await emitRow(env, 'messages', 'UPDATE', row);
    return null;
  },

  async log_mood(env, userId, a) {
    await requireMember(env, userId, a.p_relationship_id);
    const mood = String(a.p_mood ?? '').trim();
    if (!mood) throw new ApiError('Mood is required');
    if (mood.length > MAX_CHARS.mood) throw new ApiError('Mood is too long');
    const row = await env.DB.prepare('INSERT INTO mood_logs (id, relationship_id, user_id, mood) VALUES (?1, ?2, ?3, ?4) RETURNING *')
      .bind(generateId(), a.p_relationship_id, userId, mood)
      .first<Record<string, unknown>>();
    if (!row) throw new ApiError('Could not log mood');
    await emitRow(env, 'mood_logs', 'INSERT', row);
    await afterInsert(env, 'mood_logs', row, userId);
    return shapeRow(row);
  },

  async get_mood_history_page(env, userId, a) {
    await requireMember(env, userId, a.p_relationship_id);
    const binds: unknown[] = [a.p_relationship_id];
    let sql = 'SELECT * FROM mood_logs WHERE relationship_id = ?1';
    if (a.p_filter_user_id) {
      binds.push(a.p_filter_user_id);
      sql += ` AND user_id = ?${binds.length}`;
    }
    if (a.p_before) {
      binds.push(a.p_before);
      sql += ` AND created_at < ?${binds.length}`;
    }
    binds.push(Math.min(Number(a.p_limit) || 50, 200));
    sql += ` ORDER BY created_at DESC LIMIT ?${binds.length}`;
    const { results } = await env.DB.prepare(sql).bind(...binds).all<Record<string, unknown>>();
    return results;
  },

  async get_streak_status(env, userId, a) {
    await requireMember(env, userId, a.p_relationship_id);
    return getStreakStatus(env, a.p_relationship_id, userId);
  },

  /** Played together today (a game, a live game, a pack, a quiz, an activity): keeps your streak. */
  async record_play_checkin(env, userId, a) {
    await requireMember(env, userId, a.p_relationship_id);
    await updateStreak(env, a.p_relationship_id, userId);
    return null;
  },

  async restore_streak(env, userId, a) {
    await requireMember(env, userId, a.p_relationship_id);
    return restoreStreak(env, a.p_relationship_id, userId);
  },

  async create_partner_notification(env, userId, a) {
    await requireMember(env, userId, a.p_relationship_id);
    if (a.p_recipient_id === userId) return null;
    const type = String(a.p_type ?? '');
    if (!PARTNER_NOTIFICATION_TYPES.has(type)) throw new ApiError('Unknown notification type', 400);
    await consumeRateLimit(env, `partner-notify:${userId}`, PARTNER_NOTIFICATIONS_PER_HOUR, 3600);
    return createPartnerNotification(env, {
      relationshipId: a.p_relationship_id,
      recipientId: a.p_recipient_id,
      type,
      content: String(a.p_content ?? '').slice(0, PARTNER_NOTIFICATION_MAX_CHARS),
      mediaUrl: a.p_media_url,
      relatedId: a.p_related_id,
    });
  },

  async try_notification_dedup(env, userId, a) {
    await requireMember(env, userId, a.p_relationship_id);
    return tryNotificationDedup(env, a.p_relationship_id, String(a.p_dedup_key).slice(0, MAX_CHARS.dedupKey));
  },

  async mark_notifications_read(env, userId, a) {
    const asked = checkIds(a.p_notification_ids);
    const ids: string[] | null = asked.length ? asked : null;
    if (!ids) {
      await env.DB.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?1 AND read = 0').bind(userId).run();
      return null;
    }
    const marks = ids.map((_, i) => `?${i + 2}`).join(', ');
    await env.DB.prepare(`UPDATE notifications SET read = 1 WHERE user_id = ?1 AND read = 0 AND id IN (${marks})`)
      .bind(userId, ...ids)
      .run();
    return null;
  },

  async register_push_token(env, userId, a) {
    const token = typeof a.p_token === 'string' && a.p_token ? a.p_token : null;
    if (token && token.length > MAX_CHARS.pushToken) throw new ApiError('Invalid push token', 400);
    // One phone, one account: whoever signs in here takes the token, so the last account
    // on this phone stops getting pushes on it.
    if (token) {
      await env.DB.prepare('UPDATE users SET expo_push_token = NULL WHERE expo_push_token = ?1 AND id <> ?2')
        .bind(token, userId)
        .run();
    }
    await env.DB.prepare('UPDATE users SET expo_push_token = ?1, expo_push_token_updated_at = ?2 WHERE id = ?3')
      .bind(token, nowIso(), userId)
      .run();
    return null;
  },
};

compat.post('/rpc/:name', async (c) => {
  const handler = RPC[c.req.param('name')];
  if (!handler) {
    return c.json({ data: null, error: { code: 'PGRST202', message: `Function ${c.req.param('name')} not found` } });
  }
  try {
    // Trying invite codes: also limited per address, so many accounts at one place can't guess.
    if (c.req.param('name') === 'join_relationship_by_invite') {
      await consumeRateLimit(c.env, `join:ip:${clientIp(c)}`, 30, 600);
    }
    const args = await c.req.json<RpcArgs>().catch(() => ({}));
    const data = await handler(c.env, c.get('userId'), args);
    return c.json({ data: data ?? null, error: null });
  } catch (e) {
    return c.json({ data: null, error: dbError(e) });
  }
});

// ---------------------------------------------------------------------------
// Storage (R2). Keys are `${bucket}/${path}`; objects are served by GET /media/*.
// ---------------------------------------------------------------------------

const BUCKETS = new Set(['chat', 'moments', 'profiles']);

async function assertStorageAccess(env: Env, userId: string, bucket: string, path: string) {
  if (!BUCKETS.has(bucket) || path.includes('..')) throw new ApiError('Invalid path', 400);
  const first = path.split('/')[0];
  if (bucket === 'profiles') {
    if (first !== userId) throw new ApiError('Not allowed', 403);
    return;
  }
  if (!(await isRelationshipMember(env.DB, userId, first))) throw new ApiError('Not allowed', 403);
}

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

/** Reads the first `bytes` of a stream (for the type check); `rest` carries on from there. */
async function peekStream(stream: ReadableStream<Uint8Array>, bytes: number) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (size < bytes) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    size += value.byteLength;
  }
  const head = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    head.set(chunk, at);
    at += chunk.byteLength;
  }
  return { head, rest: reader };
}

/** The peeked bytes, then the rest of the upload, as one stream again. */
function prependChunk(head: Uint8Array, rest: ReadableStreamDefaultReader<Uint8Array>) {
  let sentHead = head.byteLength === 0;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (!sentHead) {
        sentHead = true;
        controller.enqueue(head);
        return;
      }
      const { done, value } = await rest.read();
      if (done) controller.close();
      else controller.enqueue(value);
    },
    cancel(reason) {
      return rest.cancel(reason);
    },
  });
}

compat.post('/storage/:bucket/*', async (c) => {
  try {
    const bucket = c.req.param('bucket');
    const path = decodeURIComponent(c.req.path.replace(`/storage/${bucket}/`, ''));
    await assertStorageAccess(c.env, c.get('userId'), bucket, path);
    await consumeRateLimit(c.env, `upload:${c.get('userId')}`, 60, 60);
    const header = normalizeContentType(c.req.header('Content-Type')) || 'application/octet-stream';
    const key = `${bucket}/${path}`;
    const length = Number(c.req.header('Content-Length'));
    const body = c.req.raw.body;
    if (body && Number.isFinite(length) && length > 0) {
      // Streamed: written to R2 while it's still arriving (no waiting for the whole file first).
      if (length > MAX_UPLOAD_BYTES) throw new ApiError('File too large', 413);
      const { head, rest } = await peekStream(body, 16);
      // Store images under their real type (from the bytes), so they display everywhere.
      const contentType = sniffImageType(head.buffer as ArrayBuffer) ?? header;
      const fixed = new FixedLengthStream(length);
      void prependChunk(head, rest).pipeTo(fixed.writable).catch(() => undefined);
      await c.env.STORAGE.put(key, fixed.readable, { httpMetadata: { contentType } });
    } else {
      const buffered = await c.req.arrayBuffer();
      if (buffered.byteLength > MAX_UPLOAD_BYTES) throw new ApiError('File too large', 413);
      if (buffered.byteLength === 0) throw new ApiError('Upload was empty', 400);
      const contentType = sniffImageType(buffered) ?? header;
      await c.env.STORAGE.put(key, buffered, { httpMetadata: { contentType } });
    }
    // Private files come back signed, so the app shows them without a second request.
    const signedUrl = isPrivateMediaKey(key) ? await signedMediaUrl(c.env, new URL(c.req.url).origin, key) : undefined;
    return c.json({ path, signedUrl });
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError('Upload failed', 500);
    return c.json({ error: err.message }, err.status as 400);
  }
});

compat.post('/storage-remove/:bucket', async (c) => {
  try {
    const bucket = c.req.param('bucket');
    const { paths } = await c.req.json<{ paths: string[] }>();
    for (const path of paths ?? []) {
      await assertStorageAccess(c.env, c.get('userId'), bucket, path);
      // The photo and its small copy (grids), if it has one.
      await c.env.STORAGE.delete([`${bucket}/${path}`, `${bucket}/${path}.t.jpg`]);
      const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default;
      if (edge) {
        const origin = new URL(c.req.url).origin;
        const base = `${origin}/__media-cache/${encodeURI(`${bucket}/${path}`)}`;
        await Promise.all([edge.delete(new Request(base)), edge.delete(new Request(`${base}?t=1`))]).catch(() => undefined);
      }
    }
    return c.json({ ok: true });
  } catch (e) {
    const err = e instanceof ApiError ? e : new ApiError('Delete failed', 500);
    return c.json({ error: err.message }, err.status as 400);
  }
});

// ---------------------------------------------------------------------------
// Functions (AI + push)
// ---------------------------------------------------------------------------

compat.post('/fn/:name', async (c) => {
  try {
    const body = await c.req.json<Record<string, unknown>>().catch(() => ({}));
    const data = await runFunction(c.env, c.get('userId'), c.req.param('name'), body, consumeRateLimit, (task) =>
      c.executionCtx.waitUntil(task),
    );
    return c.json({ data, error: null });
  } catch (e) {
    return c.json({ data: null, error: dbError(e) });
  }
});

export { BOOL_COLUMNS, JSON_COLUMNS };
