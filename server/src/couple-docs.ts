import { Hono } from 'hono';

import type { AuthVariables } from './auth';
import { emitRow } from './core';
import { isRelationshipMember, nowIso } from './db';
import { rateLimit } from './rate-limit';

/** The shared documents a couple can keep (see migration 0010). */
const KINDS = new Set(['albums', 'places']);
const MAX_BYTES = 256 * 1024;

export const coupleDocs = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

/** GET the couple's document: { data, version } (data null if never saved). */
coupleDocs.get('/relationships/:id/docs/:kind', async (c) => {
  const relationshipId = c.req.param('id');
  const kind = c.req.param('kind');
  if (!KINDS.has(kind)) return c.json({ error: 'Unknown document' }, 404);
  if (!(await isRelationshipMember(c.env.DB, c.get('userId'), relationshipId))) return c.json({ error: 'Forbidden' }, 403);

  const row = await c.env.DB.prepare('SELECT data, version FROM couple_docs WHERE relationship_id = ?1 AND kind = ?2')
    .bind(relationshipId, kind)
    .first<{ data: string; version: number }>();
  return c.json(row ? { data: JSON.parse(row.data), version: row.version } : { data: null, version: 0 });
});

/**
 * PUT { data, version }: saves only if `version` is still the latest, so an
 * edit made on the other phone in the meantime isn't overwritten. On a
 * clash it answers 409 with the latest copy; the app reapplies its change.
 */
coupleDocs.put('/relationships/:id/docs/:kind', rateLimit('couple-doc', 120, 60), async (c) => {
  const userId = c.get('userId');
  const relationshipId = c.req.param('id');
  const kind = c.req.param('kind');
  if (!KINDS.has(kind)) return c.json({ error: 'Unknown document' }, 404);
  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json<{ data?: unknown; version?: number }>().catch(() => ({}) as { data?: unknown; version?: number });
  if (body.data === undefined || typeof body.version !== 'number') return c.json({ error: 'Missing data or version' }, 400);
  const text = JSON.stringify(body.data);
  if (text.length > MAX_BYTES) return c.json({ error: 'Too large' }, 413);

  const next = body.version + 1;
  const now = nowIso();
  // Insert the first copy, or update only if nobody saved since this phone last read it.
  const res = await c.env.DB.prepare(
    `INSERT INTO couple_docs (relationship_id, kind, data, version, updated_at, updated_by)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT (relationship_id, kind) DO UPDATE SET
       data = excluded.data, version = excluded.version, updated_at = excluded.updated_at, updated_by = excluded.updated_by
     WHERE couple_docs.version = ?7`,
  )
    .bind(relationshipId, kind, text, next, now, userId, body.version)
    .run();

  if (res.meta.changes === 0) {
    const latest = await c.env.DB.prepare('SELECT data, version FROM couple_docs WHERE relationship_id = ?1 AND kind = ?2')
      .bind(relationshipId, kind)
      .first<{ data: string; version: number }>();
    return c.json({ error: 'Changed on the other phone', data: latest ? JSON.parse(latest.data) : null, version: latest?.version ?? 0 }, 409);
  }

  // Tell the other phone to refresh (best effort).
  c.executionCtx.waitUntil(
    emitRow(c.env, 'couple_docs', 'UPDATE', { relationship_id: relationshipId, kind, version: next, updated_by: userId }),
  );
  return c.json({ data: body.data, version: next });
});
