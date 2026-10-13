import { createClerkClient } from '@clerk/backend';
import { Hono } from 'hono';

import { requireAuth, type AuthVariables } from './auth';
import { billingWebhooks, carryPersonalPlus } from './billing';
import { compat } from './compat';
import { verifyToken } from '@clerk/backend';
import { buildUpdate, generateId, isRelationshipMember, nowIso, parseJson } from './db';
import './env';

const USERNAME_PATTERN = /^[a-z0-9_]{4,64}$/;

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

app.get('/health', async (c) => {
  const row = await c.env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>();
  return c.json({ status: 'ok', d1: row?.ok === 1, r2: Boolean(c.env.STORAGE) });
});

/** Public — serves uploaded media (avatars, moments, chat attachments) straight from R2. */
app.get('/media/*', async (c) => {
  const key = c.req.path.replace(/^\/media\//, '');
  const object = await c.env.STORAGE.get(key);
  if (!object) return c.notFound();

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: object.httpEtag,
    },
  });
});

/** Realtime hub: one Durable Object per relationship. Token rides the query string (WebSockets can't set headers). */
app.get('/ws/:relationshipId', async (c) => {
  if (c.req.header('Upgrade') !== 'websocket') return c.text('Expected websocket', 426);
  const token = c.req.query('token');
  if (!token) return c.text('Missing token', 401);

  let userId: string;
  try {
    userId = (await verifyToken(token, { secretKey: c.env.CLERK_SECRET_KEY })).sub;
  } catch {
    return c.text('Invalid or expired token', 401);
  }

  const relationshipId = c.req.param('relationshipId');
  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) return c.text('Forbidden', 403);

  const url = new URL(c.req.url);
  url.searchParams.delete('token');
  url.searchParams.set('uid', userId);
  const stub = c.env.HUB.get(c.env.HUB.idFromName(relationshipId));
  return stub.fetch(new Request(url.toString(), c.req.raw));
});

// RevenueCat calls this with its own secret, not a Clerk token, so it sits before auth.
app.route('/webhooks', billingWebhooks);

app.use('*', requireAuth);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

app.get('/me', async (c) => {
  const userId = c.get('userId');
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(userId).first();
  if (!row) return c.json({ error: 'Profile not found' }, 404);
  return c.json(row);
});

/** Creates the app-owned profile row for a Clerk user the first time they're seen. Idempotent. */
app.post('/users', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ email: string; name?: string }>();
  if (!body.email) return c.json({ error: 'email is required' }, 400);

  const existing = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(userId).first();
  if (existing) return c.json(existing);

  await c.env.DB.prepare('INSERT INTO users (id, email, name) VALUES (?1, ?2, ?3)')
    .bind(userId, body.email, body.name ?? null)
    .run();

  const created = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(userId).first();
  return c.json(created, 201);
});

const USER_UPDATE_FIELDS = [
  'name',
  'avatar_url',
  'gender',
  // Subscription fields are written only by the RevenueCat webhook (see billing.ts).
  'location_sharing_enabled',
  'location_latitude',
  'location_longitude',
  'location_label',
  'location_updated_at',
  'show_online_status',
  'last_seen_at',
  'timezone',
] as const;

app.patch('/me', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<Record<string, unknown>>();

  const update = buildUpdate(body, USER_UPDATE_FIELDS);
  if (!update) return c.json({ error: 'No recognized fields to update' }, 400);

  await c.env.DB.prepare(`UPDATE users SET ${update.setClause} WHERE id = ?${update.values.length + 1}`)
    .bind(...update.values, userId)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(userId).first();
  return c.json(updated);
});

/** Live availability check while the user types — does not claim the username. */
app.get('/username-available', async (c) => {
  const candidate = (c.req.query('u') ?? '').toLowerCase();
  if (!USERNAME_PATTERN.test(candidate)) {
    return c.json({ available: false, reason: 'invalid' });
  }

  const clerkClient = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
  const { data: matches } = await clerkClient.users.getUserList({ username: [candidate] });
  const taken = matches.some((u) => u.username?.toLowerCase() === candidate);

  return c.json({ available: !taken });
});

const IMAGE_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

app.post('/me/avatar', async (c) => {
  const userId = c.get('userId');
  const contentType = c.req.header('Content-Type') ?? '';
  const ext = IMAGE_CONTENT_TYPES[contentType];
  if (!ext) return c.json({ error: 'Unsupported image type' }, 400);

  const key = `avatars/${userId}/${generateId()}.${ext}`;
  const body = await c.req.arrayBuffer();
  await c.env.STORAGE.put(key, body, { httpMetadata: { contentType } });

  const url = new URL(c.req.url);
  const avatarUrl = `${url.protocol}//${url.host}/media/${key}`;

  await c.env.DB.prepare('UPDATE users SET avatar_url = ?1 WHERE id = ?2').bind(avatarUrl, userId).run();
  const updated = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(userId).first();
  return c.json(updated);
});

app.post('/me/push-token', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ token: string | null }>();
  await c.env.DB.prepare('UPDATE users SET expo_push_token = ?1, expo_push_token_updated_at = ?2 WHERE id = ?3')
    .bind(body.token ?? null, nowIso(), userId)
    .run();
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Relationships
// ---------------------------------------------------------------------------

app.get('/me/relationship', async (c) => {
  const userId = c.get('userId');
  const relationship = await c.env.DB.prepare(
    `SELECT * FROM relationships WHERE status <> 'ended' AND (user_1_id = ?1 OR user_2_id = ?1) ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(userId)
    .first<{ user_1_id: string; user_2_id: string | null }>();

  if (!relationship) return c.json({ relationship: null, partner: null });

  const partnerId = relationship.user_1_id === userId ? relationship.user_2_id : relationship.user_1_id;
  const partner = partnerId
    ? await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(partnerId).first()
    : null;

  return c.json({ relationship, partner });
});

app.post('/relationships', async (c) => {
  const userId = c.get('userId');
  type CreateRelationshipBody = { relationship_name?: string; anniversary_date?: string; relationship_type?: string };
  const body = await c.req.json<CreateRelationshipBody>().catch((): CreateRelationshipBody => ({}));
  const id = generateId();
  const inviteCode = generateId().slice(0, 8).toUpperCase();

  await c.env.DB.prepare(
    `INSERT INTO relationships (id, user_1_id, status, invite_code, relationship_name, anniversary_date, relationship_type)
     VALUES (?1, ?2, 'pending', ?3, ?4, ?5, ?6)`,
  )
    .bind(id, userId, inviteCode, body.relationship_name ?? 'Our Moments', body.anniversary_date ?? null, body.relationship_type ?? null)
    .run();
  await carryPersonalPlus(c.env, userId, id);

  const created = await c.env.DB.prepare('SELECT * FROM relationships WHERE id = ?1').bind(id).first();
  return c.json(created, 201);
});

/** Regenerates an invite code for an existing pending, partner-less space. */
app.post('/relationships/:id/invite-code', async (c) => {
  const userId = c.get('userId');
  const relationshipId = c.req.param('id');
  const relationship = await c.env.DB.prepare(
    `SELECT * FROM relationships WHERE id = ?1 AND user_1_id = ?2 AND user_2_id IS NULL AND status = 'pending'`,
  )
    .bind(relationshipId, userId)
    .first<{ invite_code: string | null }>();

  if (!relationship) return c.json({ error: 'Space not found' }, 404);
  if (relationship.invite_code) return c.json({ invite_code: relationship.invite_code });

  const inviteCode = generateId().slice(0, 8).toUpperCase();
  await c.env.DB.prepare('UPDATE relationships SET invite_code = ?1 WHERE id = ?2')
    .bind(inviteCode, relationshipId)
    .run();
  return c.json({ invite_code: inviteCode });
});

/** Mirrors join_relationship_by_invite(): ends the caller's own pending space, joins the target one. */
app.post('/relationships/join', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ inviteCode: string }>();
  const code = body.inviteCode?.trim().toUpperCase();
  if (!code || code.length < 6) return c.json({ error: 'Invalid or expired invite code' }, 400);

  const target = await c.env.DB.prepare(
    `SELECT * FROM relationships WHERE invite_code = ?1 AND status = 'pending' AND user_2_id IS NULL LIMIT 1`,
  )
    .bind(code)
    .first<{ id: string; user_1_id: string }>();

  if (!target) return c.json({ error: 'Invalid or expired invite code' }, 404);
  if (target.user_1_id === userId) {
    return c.json({ error: "That's your own code. Share it with your partner, or enter their code instead." }, 400);
  }

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE relationships SET status = 'ended', invite_code = NULL, subscription_tier = 'free', subscription_owner_id = NULL
       WHERE user_1_id = ?1 AND user_2_id IS NULL AND status = 'pending' AND id <> ?2`,
    ).bind(userId, target.id),
    c.env.DB.prepare(
      `UPDATE relationships SET user_2_id = ?1, status = 'active', invite_code = NULL WHERE id = ?2`,
    ).bind(userId, target.id),
  ]);
  // If the joining partner already pays, their Plus now covers this couple.
  await carryPersonalPlus(c.env, userId, target.id);

  const joined = await c.env.DB.prepare('SELECT * FROM relationships WHERE id = ?1').bind(target.id).first();
  const partner = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(target.user_1_id).first();
  return c.json({ relationship: joined, partner });
});

app.patch('/relationships/:id', async (c) => {
  const userId = c.get('userId');
  const relationshipId = c.req.param('id');
  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) {
    return c.json({ error: 'Not allowed to update this relationship' }, 403);
  }

  const body = await c.req.json<Record<string, unknown>>();
  const update = buildUpdate(body, ['relationship_name', 'anniversary_date', 'relationship_type', 'distance_mode']);
  if (!update) return c.json({ error: 'No recognized fields to update' }, 400);

  await c.env.DB.prepare(
    `UPDATE relationships SET ${update.setClause} WHERE id = ?${update.values.length + 1}`,
  )
    .bind(...update.values, relationshipId)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM relationships WHERE id = ?1').bind(relationshipId).first();
  return c.json(updated);
});

// ---------------------------------------------------------------------------
// Moments
// ---------------------------------------------------------------------------

app.get('/relationships/:id/moments', async (c) => {
  const userId = c.get('userId');
  const relationshipId = c.req.param('id');
  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) return c.json({ error: 'Forbidden' }, 403);

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM moments WHERE relationship_id = ?1 ORDER BY created_at DESC',
  )
    .bind(relationshipId)
    .all();
  return c.json(results);
});

app.post('/relationships/:id/moments', async (c) => {
  const userId = c.get('userId');
  const relationshipId = c.req.param('id');
  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json<{ type: string; media_url?: string; content?: string; mood?: string }>();
  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO moments (id, relationship_id, user_id, type, content, media_url, mood) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
  )
    .bind(id, relationshipId, userId, body.type, body.content ?? null, body.media_url ?? null, body.mood ?? null)
    .run();

  const created = await c.env.DB.prepare('SELECT * FROM moments WHERE id = ?1').bind(id).first();
  return c.json(created, 201);
});

app.post('/moments/:id/viewed', async (c) => {
  const userId = c.get('userId');
  const momentId = c.req.param('id');

  const moment = await c.env.DB.prepare('SELECT relationship_id, viewed_by FROM moments WHERE id = ?1')
    .bind(momentId)
    .first<{ relationship_id: string; viewed_by: string }>();
  if (!moment || !(await isRelationshipMember(c.env.DB, userId, moment.relationship_id))) {
    return c.json({ error: 'Moment not found' }, 404);
  }

  const viewed = parseJson<string[]>(moment.viewed_by, []);
  if (!viewed.includes(userId)) {
    viewed.push(userId);
    await c.env.DB.prepare('UPDATE moments SET viewed_by = ?1 WHERE id = ?2')
      .bind(JSON.stringify(viewed), momentId)
      .run();
  }
  return c.json({ ok: true });
});

app.delete('/moments/:id', async (c) => {
  const userId = c.get('userId');
  const momentId = c.req.param('id');
  const result = await c.env.DB.prepare('DELETE FROM moments WHERE id = ?1 AND user_id = ?2')
    .bind(momentId, userId)
    .run();
  if (result.meta.changes === 0) return c.json({ error: 'Moment not found' }, 404);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

app.get('/relationships/:id/messages', async (c) => {
  const userId = c.get('userId');
  const relationshipId = c.req.param('id');
  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) return c.json({ error: 'Forbidden' }, 403);

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM messages WHERE relationship_id = ?1 ORDER BY created_at DESC LIMIT 200',
  )
    .bind(relationshipId)
    .all();
  return c.json(results);
});

app.post('/relationships/:id/messages', async (c) => {
  const userId = c.get('userId');
  const relationshipId = c.req.param('id');
  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json<{ content?: string; media_url?: string; media_type?: string }>();
  const id = generateId();
  await c.env.DB.prepare(
    'INSERT INTO messages (id, relationship_id, sender_id, content, media_url, media_type) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
  )
    .bind(id, relationshipId, userId, body.content ?? null, body.media_url ?? null, body.media_type ?? null)
    .run();

  const created = await c.env.DB.prepare('SELECT * FROM messages WHERE id = ?1').bind(id).first();
  return c.json(created, 201);
});

app.post('/relationships/:id/messages/read', async (c) => {
  const userId = c.get('userId');
  const relationshipId = c.req.param('id');
  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) return c.json({ error: 'Forbidden' }, 403);

  await c.env.DB.prepare(
    `UPDATE messages SET read_at = ?1 WHERE relationship_id = ?2 AND sender_id <> ?3 AND read_at IS NULL`,
  )
    .bind(nowIso(), relationshipId, userId)
    .run();
  return c.json({ ok: true });
});

app.post('/messages/:id/react', async (c) => {
  const userId = c.get('userId');
  const messageId = c.req.param('id');
  const body = await c.req.json<{ emoji: string }>();

  const message = await c.env.DB.prepare('SELECT relationship_id, reactions FROM messages WHERE id = ?1')
    .bind(messageId)
    .first<{ relationship_id: string; reactions: string }>();
  if (!message || !(await isRelationshipMember(c.env.DB, userId, message.relationship_id))) {
    return c.json({ error: 'Message not found' }, 404);
  }

  const reactions = parseJson<Record<string, string[]>>(message.reactions, {});
  for (const emoji of Object.keys(reactions)) {
    reactions[emoji] = reactions[emoji].filter((u) => u !== userId);
    if (reactions[emoji].length === 0) delete reactions[emoji];
  }
  const hadEmoji = parseJson<Record<string, string[]>>(message.reactions, {})[body.emoji]?.includes(userId);
  if (!hadEmoji) {
    reactions[body.emoji] = [...(reactions[body.emoji] ?? []), userId];
  }

  await c.env.DB.prepare('UPDATE messages SET reactions = ?1 WHERE id = ?2')
    .bind(JSON.stringify(reactions), messageId)
    .run();
  return c.json(reactions);
});

app.post('/messages/:id/hide', async (c) => {
  const userId = c.get('userId');
  const messageId = c.req.param('id');

  const message = await c.env.DB.prepare('SELECT relationship_id, hidden_for FROM messages WHERE id = ?1')
    .bind(messageId)
    .first<{ relationship_id: string; hidden_for: string }>();
  if (!message || !(await isRelationshipMember(c.env.DB, userId, message.relationship_id))) {
    return c.json({ error: 'Message not found' }, 404);
  }

  const hidden = parseJson<string[]>(message.hidden_for, []);
  if (!hidden.includes(userId)) {
    hidden.push(userId);
    await c.env.DB.prepare('UPDATE messages SET hidden_for = ?1 WHERE id = ?2')
      .bind(JSON.stringify(hidden), messageId)
      .run();
  }
  return c.json({ ok: true });
});

app.post('/messages/:id/pin', async (c) => {
  const userId = c.get('userId');
  const messageId = c.req.param('id');
  const body = await c.req.json<{ pinned: boolean }>();

  const message = await c.env.DB.prepare('SELECT relationship_id FROM messages WHERE id = ?1')
    .bind(messageId)
    .first<{ relationship_id: string }>();
  if (!message || !(await isRelationshipMember(c.env.DB, userId, message.relationship_id))) {
    return c.json({ error: 'Message not found' }, 404);
  }

  await c.env.DB.prepare('UPDATE messages SET is_pinned = ?1 WHERE id = ?2')
    .bind(body.pinned ? 1 : 0, messageId)
    .run();
  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Mood
// ---------------------------------------------------------------------------

app.get('/relationships/:id/moods', async (c) => {
  const userId = c.get('userId');
  const relationshipId = c.req.param('id');
  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) return c.json({ error: 'Forbidden' }, 403);

  const { results } = await c.env.DB.prepare(
    'SELECT * FROM mood_logs WHERE relationship_id = ?1 ORDER BY created_at DESC LIMIT 500',
  )
    .bind(relationshipId)
    .all();
  return c.json(results);
});

app.post('/relationships/:id/moods', async (c) => {
  const userId = c.get('userId');
  const relationshipId = c.req.param('id');
  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json<{ mood: string }>();
  if (!body.mood?.trim()) return c.json({ error: 'Mood is required' }, 400);

  const id = generateId();
  await c.env.DB.prepare('INSERT INTO mood_logs (id, relationship_id, user_id, mood) VALUES (?1, ?2, ?3, ?4)')
    .bind(id, relationshipId, userId, body.mood)
    .run();

  const created = await c.env.DB.prepare('SELECT * FROM mood_logs WHERE id = ?1').bind(id).first();
  return c.json(created, 201);
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

app.get('/me/notifications', async (c) => {
  const userId = c.get('userId');
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM notifications WHERE user_id = ?1 ORDER BY created_at DESC LIMIT 100',
  )
    .bind(userId)
    .all();
  return c.json(results);
});

app.post('/notifications/read', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ ids?: string[] }>().catch(() => ({ ids: undefined }));

  if (!body.ids || body.ids.length === 0) {
    const result = await c.env.DB.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?1 AND read = 0')
      .bind(userId)
      .run();
    return c.json({ count: result.meta.changes });
  }

  const placeholders = body.ids.map((_, i) => `?${i + 2}`).join(', ');
  const result = await c.env.DB.prepare(
    `UPDATE notifications SET read = 1 WHERE user_id = ?1 AND read = 0 AND id IN (${placeholders})`,
  )
    .bind(userId, ...body.ids)
    .run();
  return c.json({ count: result.meta.changes });
});

// ---------------------------------------------------------------------------
// Streaks
// ---------------------------------------------------------------------------

app.get('/relationships/:id/streak', async (c) => {
  const userId = c.get('userId');
  const relationshipId = c.req.param('id');
  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) return c.json({ error: 'Forbidden' }, 403);

  const streak = await c.env.DB.prepare('SELECT * FROM streaks WHERE relationship_id = ?1')
    .bind(relationshipId)
    .first();

  if (!streak) {
    return c.json({
      relationship_id: relationshipId,
      current_streak: 0,
      longest_streak: 0,
      last_active_date: null,
    });
  }
  return c.json(streak);
});

app.route('/', compat);

export { Hub } from './hub';

export default app;
