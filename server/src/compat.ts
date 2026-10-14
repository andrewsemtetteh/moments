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
  restoreStreak,
  shapeRow,
  toBind,
  tryNotificationDedup,
  updateStreak,
} from './core';
import { generateId, isRelationshipMember, nowIso, parseJson, relationshipIdsForUser } from './db';
import { stripProtected } from './billing';
import { runFunction } from './functions';
import { normalizeContentType, sniffImageType } from './media-type';
import { onPaired } from './pairing';
import './env';

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
      sql = `${f.col} IN (${list.map((v) => p(v)).join(', ')})`;
      break;
    }
    default:
      throw new ApiError(`Unsupported operator ${f.op}`, 400);
  }
  return f.negate ? `NOT (${sql})` : sql;
}

function dbError(e: unknown) {
  if (e instanceof ApiError) return { message: e.message, code: e.code ?? String(e.status) };
  const message = e instanceof Error ? e.message : 'Request failed';
  return { message, code: /no such (table|column)/i.test(message) ? '42P01' : 'D1_ERROR' };
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

    const shape = (rows: Record<string, unknown>[]) => rows.map((r) => shapeRow(r));
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
      const inserted: Record<string, unknown>[] = [];
      for (const raw of list) {
        // Plus is granted only by the Superwall webhook.
        const values: Record<string, unknown> =
          req.table === 'users' || req.table === 'relationships' ? stripProtected({ ...raw }) : { ...raw };
        if (policy.forceMe) values[policy.forceMe] = userId;
        if (cols.has('id') && !values.id) values.id = generateId();
        if (cols.has('relationship_id') && typeof values.relationship_id === 'string' && policy.scope === 'rel') {
          if (!myRelIds.includes(values.relationship_id)) throw new ApiError('Not allowed', 403, '42501');
        } else if (policy.scope === 'rel') {
          throw new ApiError('relationship_id is required', 400, '23502');
        }
        if (req.table === 'analytics_events' && typeof values.relationship_id === 'string' && !myRelIds.includes(values.relationship_id)) {
          values.relationship_id = null;
        }
        if (req.table === 'relationships' && !values.invite_code) values.invite_code = null;
        if (req.table === 'users' && values.id !== userId) throw new ApiError('Not allowed', 403, '42501');

        const keys = Object.keys(values).filter((k) => IDENT.test(k) && cols.has(k));
        const binds = keys.map((k) => toBind(k, values[k]));
        let sql = `INSERT INTO ${req.table} (${keys.join(', ')}) VALUES (${keys.map((_, i) => `?${i + 1}`).join(', ')})`;
        if (req.op === 'upsert') {
          const conflict = req.onConflict && cols.has(req.onConflict) ? req.onConflict : 'id';
          const updates = keys.filter((k) => k !== conflict);
          sql += updates.length
            ? ` ON CONFLICT (${conflict}) DO UPDATE SET ${updates.map((k) => `${k} = excluded.${k}`).join(', ')}`
            : ` ON CONFLICT (${conflict}) DO NOTHING`;
        }
        sql += ' RETURNING *';
        const row = await env.DB.prepare(sql).bind(...binds).first<Record<string, unknown>>();
        if (row) inserted.push(row);
      }

      for (const row of inserted) {
        await emitRow(env, req.table, 'INSERT', row);
        await afterInsert(env, req.table, row, userId);
      }
      return c.json(finish(inserted));
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
      const patch =
        req.table === 'users' || req.table === 'relationships'
          ? stripProtected({ ...(req.values as Record<string, unknown>) })
          : { ...(req.values as Record<string, unknown>) };
      delete patch.id;
      const keys = Object.keys(patch).filter((k) => IDENT.test(k) && cols.has(k));
      if (keys.length === 0) throw new ApiError('No columns to update', 400);
      if (req.table === 'relationships' && Object.keys(patch).some((k) => k === 'user_1_id' || k === 'user_2_id')) {
        throw new ApiError('Not allowed', 403, '42501');
      }

      const oldRows =
        req.table === 'daily_challenges'
          ? (await env.DB.prepare(`SELECT * FROM daily_challenges WHERE ${whereSql}`).bind(...binds).all<Record<string, unknown>>()).results
          : [];

      const setBinds = keys.map((k) => toBind(k, patch[k]));
      const shifted = whereSql.replace(/\?(\d+)/g, (_m, n) => `?${Number(n) + setBinds.length}`);
      const sql = `UPDATE ${req.table} SET ${keys.map((k, i) => `${k} = ?${i + 1}`).join(', ')} WHERE ${shifted} RETURNING *`;
      const { results } = await env.DB.prepare(sql).bind(...setBinds, ...binds).all<Record<string, unknown>>();

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

  if (table === 'messages' || table === 'moments') {
    await updateStreak(env, relId, userId);
  } else if (table === 'journal_entries' && row.is_private === 0) {
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

  if (both && (newly1 || newly2)) await updateStreak(env, relId, null);

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

function toggleReaction(raw: string | null, userId: string, emoji: string): Record<string, string[]> {
  const previous = parseJson<Record<string, string[]>>(raw, {});
  const had = previous[emoji]?.includes(userId);
  const next: Record<string, string[]> = {};
  for (const [key, users] of Object.entries(previous)) {
    const rest = users.filter((u) => u !== userId);
    if (rest.length) next[key] = rest;
  }
  if (!had) next[emoji] = [...(next[emoji] ?? []), userId];
  return next;
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
    return row ? shapeRow(row) : null;
  },

  async join_relationship_by_invite(env, userId, a) {
    // Invite codes are short: limit guesses (10 per 10 minutes per person).
    await consumeRateLimit(env, `join:${userId}`, 10, 600);
    const code = String(a.p_invite_code ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    if (code.length < 6) throw new ApiError('Invalid or expired invite code');
    const target = await env.DB.prepare(
      `SELECT * FROM relationships WHERE invite_code = ?1 AND status = 'pending' AND user_2_id IS NULL LIMIT 1`,
    )
      .bind(code)
      .first<{ id: string; user_1_id: string }>();
    if (!target) throw new ApiError('Invalid or expired invite code');
    if (target.user_1_id === userId) throw new ApiError("That's your own code. Share it with your partner, or enter their code instead.");

    await env.DB.batch([
      env.DB.prepare(
        `UPDATE relationships SET status = 'ended', invite_code = NULL, subscription_tier = 'free', subscription_owner_id = NULL
         WHERE user_1_id = ?1 AND user_2_id IS NULL AND status = 'pending' AND id <> ?2`,
      ).bind(userId, target.id),
      env.DB.prepare(`UPDATE relationships SET user_2_id = ?1, status = 'active', invite_code = NULL WHERE id = ?2`).bind(userId, target.id),
      env.DB.prepare('INSERT OR IGNORE INTO streaks (id, relationship_id) VALUES (?1, ?2)').bind(generateId(), target.id),
    ]);
    const joined = await env.DB.prepare('SELECT * FROM relationships WHERE id = ?1').bind(target.id).first<Record<string, unknown>>();
    if (joined) await emitRow(env, 'relationships', 'UPDATE', joined);
    await onPaired(env, target.id, userId, target.user_1_id);
    return joined ? shapeRow(joined) : null;
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
    // Optional pin for "Our map" — only kept when both are real coordinates.
    const lat = Number(a.p_latitude);
    const lng = Number(a.p_longitude);
    const hasPin =
      a.p_latitude != null && a.p_longitude != null &&
      Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
    const row = await env.DB.prepare(
      `INSERT INTO moments (id, relationship_id, user_id, type, content, media_url, latitude, longitude) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) RETURNING *`,
    )
      .bind(
        generateId(),
        a.p_relationship_id,
        userId,
        a.p_type,
        a.p_content ?? null,
        a.p_media_url ?? null,
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
    const viewed = parseJson<string[]>(moment.viewed_by, []);
    if (moment.user_id === userId || viewed.includes(userId)) return null;
    viewed.push(userId);
    const row = await env.DB.prepare('UPDATE moments SET viewed_by = ?1 WHERE id = ?2 RETURNING *')
      .bind(JSON.stringify(viewed), a.p_moment_id)
      .first<Record<string, unknown>>();
    if (row) await emitRow(env, 'moments', 'UPDATE', row);
    return null;
  },

  async toggle_moment_reaction(env, userId, a) {
    const moment = await env.DB.prepare('SELECT * FROM moments WHERE id = ?1').bind(a.p_moment_id).first<Record<string, any>>();
    if (!moment) throw new ApiError('Moment not found', 404);
    await requireMember(env, userId, moment.relationship_id);
    const next = toggleReaction(moment.reactions, userId, a.p_emoji);
    const row = await env.DB.prepare('UPDATE moments SET reactions = ?1 WHERE id = ?2 RETURNING *')
      .bind(JSON.stringify(next), a.p_moment_id)
      .first<Record<string, unknown>>();
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
    const message = await loadMessage(env, userId, a.p_message_id);
    await saveMessage(env, a.p_message_id, { reactions: toggleReaction(message.reactions, userId, a.p_emoji) });
    return null;
  },

  async set_message_pinned(env, userId, a) {
    await loadMessage(env, userId, a.p_message_id);
    await saveMessage(env, a.p_message_id, { is_pinned: !!a.p_is_pinned, pinned_at: a.p_is_pinned ? nowIso() : null });
    return null;
  },

  async hide_message_for_user(env, userId, a) {
    const message = await loadMessage(env, userId, a.p_message_id);
    const hidden = parseJson<string[]>(message.hidden_for, []);
    if (!hidden.includes(userId)) await saveMessage(env, a.p_message_id, { hidden_for: [...hidden, userId] });
    return null;
  },

  async log_mood(env, userId, a) {
    await requireMember(env, userId, a.p_relationship_id);
    const mood = String(a.p_mood ?? '').trim();
    if (!mood) throw new ApiError('Mood is required');
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

  async restore_streak(env, userId, a) {
    await requireMember(env, userId, a.p_relationship_id);
    return restoreStreak(env, a.p_relationship_id, userId);
  },

  async create_partner_notification(env, userId, a) {
    await requireMember(env, userId, a.p_relationship_id);
    if (a.p_recipient_id === userId) return null;
    return createPartnerNotification(env, {
      relationshipId: a.p_relationship_id,
      recipientId: a.p_recipient_id,
      type: String(a.p_type ?? ''),
      content: String(a.p_content ?? ''),
      mediaUrl: a.p_media_url,
      relatedId: a.p_related_id,
    });
  },

  async try_notification_dedup(env, userId, a) {
    await requireMember(env, userId, a.p_relationship_id);
    return tryNotificationDedup(env, a.p_relationship_id, String(a.p_dedup_key));
  },

  async mark_notifications_read(env, userId, a) {
    const ids: string[] | null = Array.isArray(a.p_notification_ids) && a.p_notification_ids.length ? a.p_notification_ids : null;
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
    await env.DB.prepare('UPDATE users SET expo_push_token = ?1, expo_push_token_updated_at = ?2 WHERE id = ?3')
      .bind(a.p_token ?? null, nowIso(), userId)
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

compat.post('/storage/:bucket/*', async (c) => {
  try {
    const bucket = c.req.param('bucket');
    const path = decodeURIComponent(c.req.path.replace(`/storage/${bucket}/`, ''));
    await assertStorageAccess(c.env, c.get('userId'), bucket, path);
    await consumeRateLimit(c.env, `upload:${c.get('userId')}`, 60, 60);
    const body = await c.req.arrayBuffer();
    if (body.byteLength > 50 * 1024 * 1024) throw new ApiError('File too large', 413);
    if (body.byteLength === 0) throw new ApiError('Upload was empty', 400);
    // Store images under their real type (from the bytes), so they display everywhere.
    const header = normalizeContentType(c.req.header('Content-Type')) || 'application/octet-stream';
    const contentType = sniffImageType(body) ?? header;
    await c.env.STORAGE.put(`${bucket}/${path}`, body, { httpMetadata: { contentType } });
    return c.json({ path });
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
      await c.env.STORAGE.delete(`${bucket}/${path}`);
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
