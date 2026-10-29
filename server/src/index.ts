import { createClerkClient } from '@clerk/backend';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { deleteAccount } from './account';
import { requireAuth, type AuthVariables } from './auth';
import { assertMomentAllowance, billingWebhooks, carryPersonalPlus, ensureBillingUserId } from './billing';
import { ApiError, emitRow, publicProfile } from './core';
import { type JobMessage, runJobPages, startHourlyJobs } from './jobs';
import { profileUpdateError } from './profile-rules';
import { compat } from './compat';
import { links } from './links';
import { coupleDocs } from './couple-docs';
import { stockBanks } from './functions';
import { verifyToken } from '@clerk/backend';
import { buildUpdate, clientOrNewId, generateId, isRelationshipMember, toggleReaction, updateJsonColumn, withUser, newInviteCode, nowIso, parseJson, relationshipIdsForUser } from './db';
import { joinWithInviteCode, onPaired } from './pairing';
import { hasMediaUrl, isPrivateMediaKey, signedMediaUrl, signMediaInText, verifyMediaSignature } from './media-sign';
import { isInlineMediaType, resolveImageType } from './media-type';
import { type PushRetry, retryPushes } from './push';
import { checkIds, checkText, MAX_CHARS } from './limits';
import { ipRateLimit, rateLimit } from './rate-limit';
import { runWithContext } from './request-context';
import { issueWsTicket, verifyWsTicket } from './ws-ticket';
import { claimReferral, referralSummary } from './referrals';
import './env';

const USERNAME_PATTERN = /^[a-z0-9_]{4,64}$/;

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

/**
 * A row this save already made (a retried request with the app's id): that row when it's the
 * caller's in this space, 'taken' when the id belongs to something else, null when it's new.
 */
async function findOwnRow(
  env: Env,
  table: 'moments' | 'messages',
  id: string,
  relationshipId: string,
  ownerColumn: 'user_id' | 'sender_id',
  userId: string,
): Promise<Record<string, unknown> | 'taken' | null> {
  const row = await env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?1`).bind(id).first<Record<string, unknown>>();
  if (!row) return null;
  return row.relationship_id === relationshipId && row[ownerColumn] === userId ? row : 'taken';
}

// Lets helpers finish side work (pushes, realtime) after the answer is sent (request-context.ts).
app.use('*', (c, next) => {
  let ctx: { waitUntil(promise: Promise<unknown>): void } | undefined;
  try {
    ctx = c.executionCtx;
  } catch {
    ctx = undefined;
  }
  return runWithContext(ctx, next);
});

// HTTPS only from now on, and no guessing a response's type.
app.use('*', async (c, next) => {
  await next();
  // A WebSocket upgrade comes back from the realtime hub as is (its headers can't change).
  if (c.res.status === 101) return;
  try {
    c.res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    if (!c.res.headers.has('X-Content-Type-Options')) c.res.headers.set('X-Content-Type-Options', 'nosniff');
  } catch {
    // Read-only headers (a response passed straight through): leave them.
  }
});

// No reading a giant body into memory: JSON is capped well above the biggest real one (a shared
// doc is at most 256 KB), the profile photo at 16 MB. Uploads stream with their own 50 MB cap.
const JSON_BODY_LIMIT = 512 * 1024;
app.use('*', (c, next) => {
  const path = c.req.path;
  if (c.req.method === 'GET' || c.req.method === 'HEAD' || path.startsWith('/storage/')) return next();
  const maxSize = path === '/me/avatar' ? 16 * 1024 * 1024 : JSON_BODY_LIMIT;
  return bodyLimit({ maxSize, onError: (cc) => cc.json({ error: 'That request is too large' }, 413) })(c, next);
});

// Every JSON answer (tables, functions, profiles…) goes out with its moment and chat media
// links signed, so the app never needs to build one (see media-sign.ts).
app.use('*', async (c, next) => {
  await next();
  if (!(c.res.headers.get('Content-Type') ?? '').includes('application/json')) return;
  // Signed for a signed-in caller only, and only their own spaces' files.
  const userId = (c.var as Partial<AuthVariables>).userId;
  if (!userId) return;
  const text = await c.res.clone().text();
  if (!hasMediaUrl(text)) return;
  const mine = new Set(await relationshipIdsForUser(c.env.DB, userId));
  const signed = await signMediaInText(c.env, text, (id) => mine.has(id));
  if (signed !== text) c.res = new Response(signed, { status: c.res.status, headers: c.res.headers });
});

// Uptime checks: answers without touching the database, so it can't be used to load it.
app.get('/health', (c) => c.json({ status: 'ok' }));

/**
 * Serves uploaded media (avatars, moments, chat attachments) from R2. A link works for whoever
 * has it, like a private share link: new files have unguessable names (see the app's
 * unguessablePath) and deleting a moment or message removes its file. Only real media is shown
 * inline; anything else downloads, so a file can never run as a page on this domain.
 */
app.get('/media/*', async (c) => {
  const key = decodeURIComponent(c.req.path.replace(/^\/media\//, ''));
  if (!/^(moments|chat|profiles|avatars)\//.test(key) || key.includes('..')) return c.notFound();
  // Moments and chat files need a signed, unexpired link; avatars are public.
  if (isPrivateMediaKey(key) && !(await verifyMediaSignature(c.env, key, c.req.query('e'), c.req.query('s')))) {
    return c.text('This link has expired', 403);
  }
  // Range requests: iPhone's audio/video players fetch byte ranges and wait forever without them.
  const ranged = !!c.req.header('Range');

  // Cloudflare's edge cache, keyed by the file (not the signature, which was checked above): a
  // photo seen once is served from the nearest Cloudflare location after that, without a trip to
  // R2. (It only works on a custom domain; on workers.dev the cache is simply skipped.)
  const variant = c.req.query('t') === '1' ? '?t=1' : '';
  const edgeKey = new Request(`${new URL(c.req.url).origin}/__media-cache/${encodeURI(key)}${variant}`);
  const edge = (globalThis as { caches?: { default?: Cache } }).caches?.default;
  if (!ranged && edge) {
    const hit = await edge.match(edgeKey).catch(() => undefined);
    if (hit) {
      // Back to the viewer as private (the cached copy is only shared inside Cloudflare).
      const out = new Response(hit.body, hit);
      out.headers.set('Cache-Control', 'private, max-age=31536000, immutable');
      return out;
    }
  }
  // `t=1`: the photo's small copy (made at upload, `<key>.t.jpg`) for grids and albums — the
  // same signed link covers it. Older photos have none: the full one is served instead.
  const thumb = c.req.query('t') === '1' && !ranged ? await c.env.STORAGE.get(`${key}.t.jpg`) : null;
  // A video's still that was never made (older videos): say so, rather than send the whole
  // video to an image — the app then grabs a frame itself.
  if (c.req.query('t') === '1' && !ranged && !thumb && /\.(mp4|mov|m4v|webm)$/i.test(key)) return c.notFound();
  const object = thumb ?? (await c.env.STORAGE.get(key, ranged ? { range: c.req.raw.headers } : undefined));
  if (!object) return c.notFound();

  const stored = object.httpMetadata?.contentType ?? 'application/octet-stream';
  const inline = isInlineMediaType(stored);
  const headers: Record<string, string> = {
    'Content-Type': inline ? stored : 'application/octet-stream',
    // Private to the viewer's device (no shared caches keep a copy).
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Referrer-Policy': 'no-referrer',
    ETag: object.httpEtag,
    'Accept-Ranges': 'bytes',
  };
  if (!inline) headers['Content-Disposition'] = 'attachment';

  const size = object.size;
  const r = object.range as { offset?: number; length?: number; suffix?: number } | undefined;
  if (ranged && r) {
    const start = r.suffix != null ? Math.max(0, size - r.suffix) : (r.offset ?? 0);
    const length = r.suffix != null ? size - start : (r.length ?? size - start);
    headers['Content-Range'] = `bytes ${start}-${start + length - 1}/${size}`;
    headers['Content-Length'] = String(length);
    return new Response(object.body, { status: 206, headers });
  }
  headers['Content-Length'] = String(size);
  if (edge) {
    // One copy for the viewer, one kept at the edge (files never change: a new photo is a new name).
    const [forViewer, forEdge] = object.body.tee();
    c.executionCtx.waitUntil(
      edge
        .put(edgeKey, new Response(forEdge, { headers: { ...headers, 'Cache-Control': 'public, max-age=2592000' } }))
        .catch(() => undefined),
    );
    return new Response(forViewer, { headers });
  }
  return new Response(object.body, { headers });
});

/**
 * Realtime hub: one Durable Object per relationship. A WebSocket can't set headers, so it opens
 * with a one-minute ticket (POST /ws-ticket) in the address. Builds from before tickets still
 * send their sign-in token there instead; that keeps working until they've updated.
 */
app.get('/ws/:relationshipId', ipRateLimit('ws', 60, 60), async (c) => {
  if (c.req.header('Upgrade') !== 'websocket') return c.text('Expected websocket', 426);
  const relationshipId = c.req.param('relationshipId');
  const ticket = c.req.query('ticket');
  const token = c.req.query('token');

  let userId: string | null = null;
  if (ticket) {
    userId = await verifyWsTicket(c.env, ticket, relationshipId);
  } else if (token) {
    try {
      userId = (await verifyToken(token, { secretKey: c.env.CLERK_SECRET_KEY, jwtKey: c.env.CLERK_JWT_KEY })).sub;
    } catch {
      userId = null;
    }
  } else {
    return c.text('Missing ticket', 401);
  }
  if (!userId) return c.text('Invalid or expired ticket', 401);

  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) return c.text('Forbidden', 403);

  const url = new URL(c.req.url);
  url.searchParams.delete('token');
  url.searchParams.delete('ticket');
  url.searchParams.set('uid', userId);
  const stub = c.env.HUB.get(c.env.HUB.idFromName(relationshipId));
  return stub.fetch(new Request(url.toString(), c.req.raw));
});

// Share links (verification files + a page for people without the app). Public.
app.route('/', links);

// Superwall signs its webhook with its own secret, not a Clerk token, so it sits before auth.
app.route('/webhooks', billingWebhooks);

app.use('*', requireAuth);

// A ceiling on any one person's calls of every kind (a runaway loop or a script), on top of the
// tighter per-route limits.
app.use('*', rateLimit('api', 600, 60));

/** A one-minute ticket to open this space's realtime (see GET /ws/:relationshipId). */
app.post('/ws-ticket', rateLimit('ws-ticket', 60, 60), async (c) => {
  const userId = c.get('userId');
  const { relationshipId } = await c.req.json<{ relationshipId?: string }>().catch(() => ({ relationshipId: undefined }));
  const relId = String(relationshipId ?? '');
  if (!relId || !(await isRelationshipMember(c.env.DB, userId, relId))) return c.json({ error: 'Not allowed' }, 403);
  return c.json({ ticket: await issueWsTicket(c.env, userId, relId) });
});

/** A signed link for a file this person just uploaded (or any file in their space). */
app.post('/media/sign', rateLimit('media-sign', 60, 60), async (c) => {
  const userId = c.get('userId');
  const { key } = await c.req.json<{ key?: string }>().catch(() => ({ key: undefined }));
  const clean = String(key ?? '');
  if (!isPrivateMediaKey(clean) || clean.includes('..')) return c.json({ error: 'Invalid file' }, 400);
  const relationshipId = clean.split('/')[1];
  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) return c.json({ error: 'Not allowed' }, 403);
  const origin = new URL(c.req.url).origin;
  return c.json({ signedUrl: await signedMediaUrl(c.env, origin, clean) });
});

// Shared albums / place names (versioned, synced between both phones).
app.route('/', coupleDocs);

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

app.get('/me', async (c) => {
  const userId = c.get('userId');
  const row = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(userId).first();
  if (!row) return c.json({ error: 'Profile not found' }, 404);
  // The Superwall id the webhook maps purchases back by (see billing.ts).
  await ensureBillingUserId(c.env, userId, row.billing_user_id);
  return c.json(row);
});

/** Creates the app-owned profile row for a Clerk user the first time they're seen. Idempotent. */
app.post('/users', async (c) => {
  const userId = c.get('userId');
  const body = await c.req
    .json<{ email?: string; name?: string }>()
    .catch((): { email?: string; name?: string } => ({}));

  const existing = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(userId).first();
  if (existing) {
    await ensureBillingUserId(c.env, userId, existing.billing_user_id);
    return c.json(existing);
  }

  // The email comes from Clerk (verified at sign-up), never from the app: emails are unique, so
  // trusting the request let anyone take someone else's address and block their account.
  const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
  const clerkUser = await clerk.users.getUser(userId).catch(() => null);
  const verified =
    clerkUser?.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
    clerkUser?.emailAddresses[0]?.emailAddress ??
    null;
  // Sign-ins without an email (some phone / Apple relay setups): a private placeholder.
  let email = (verified ?? `${userId}@users.moments-app`).toLowerCase();
  const clash = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?1 AND id <> ?2')
    .bind(email, userId)
    .first();
  if (clash) email = `${userId}@users.moments-app`;

  // Location sharing starts off: turning it on is what asks for location permission.
  await c.env.DB.prepare('INSERT INTO users (id, email, name, location_sharing_enabled) VALUES (?1, ?2, ?3, 0)')
    .bind(userId, email, typeof body.name === 'string' ? body.name.slice(0, 80) : null)
    .run();
  await ensureBillingUserId(c.env, userId, null);

  const created = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(userId).first();
  return c.json(created, 201);
});

const USER_UPDATE_FIELDS = [
  'name',
  'avatar_url',
  'gender',
  'gender_identity',
  'birthday',
  // Subscription fields are written only by the Superwall webhook (see billing.ts).
  'location_sharing_enabled',
  'location_latitude',
  'location_longitude',
  'location_label',
  'location_updated_at',
  'show_online_status',
  'last_seen_at',
  'timezone',
] as const;

/** After changing email in Clerk: copy the new verified primary address onto the profile. */
app.post('/me/email-sync', rateLimit('email-sync', 10, 3600), async (c) => {
  const userId = c.get('userId');
  const clerk = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
  const clerkUser = await clerk.users.getUser(userId).catch(() => null);
  const verified = clerkUser?.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId);
  if (!verified || verified.verification?.status !== 'verified') return c.json({ error: 'No verified email' }, 400);
  const email = verified.emailAddress.toLowerCase();
  const clash = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?1 AND id <> ?2')
    .bind(email, userId)
    .first();
  if (clash) return c.json({ error: 'That email is already used by another account' }, 409);
  await c.env.DB.prepare('UPDATE users SET email = ?1 WHERE id = ?2').bind(email, userId).run();
  return c.json(await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(userId).first());
});

/** Is this account allowed the developer tools (DEV_TOOLS_USER_IDS)? */
function isDevToolsUser(env: Env, userId: string): boolean {
  return (env.DEV_TOOLS_USER_IDS ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId);
}

/**
 * Settings › Developer › "Pretend Plus is on": the space counts as Plus on the server too,
 * so every Plus feature works while testing. Allowlisted accounts only.
 */
app.post('/dev/plus', async (c) => {
  const userId = c.get('userId');
  if (!isDevToolsUser(c.env, userId)) {
    return c.json({ error: `Developer tools are off for this account. Add ${userId} to DEV_TOOLS_USER_IDS.`, userId }, 403);
  }
  const { on } = await c.req.json<{ on?: boolean }>();
  const row = await c.env.DB.prepare(
    `UPDATE relationships SET dev_plus = ?2
     WHERE (user_1_id = ?1 OR user_2_id = ?1) AND status != 'ended' RETURNING *`,
  )
    .bind(userId, on ? 1 : 0)
    .first<Record<string, unknown>>();
  if (row) await emitRow(c.env, 'relationships', 'UPDATE', row);
  return c.json({ ok: true, dev_plus: !!on, relationship: row ?? null });
});

app.patch('/me', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<Record<string, unknown>>();

  const problem = profileUpdateError(body);
  if (problem) return c.json({ error: problem }, 400);

  const update = buildUpdate(body, USER_UPDATE_FIELDS);
  if (!update) return c.json({ error: 'No recognized fields to update' }, 400);

  await c.env.DB.prepare(`UPDATE users SET ${update.setClause} WHERE id = ?${update.values.length + 1}`)
    .bind(...update.values, userId)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(userId).first();
  return c.json(updated);
});

/**
 * Permanently delete my account (App Store guideline 5.1.1(v)): my shared
 * spaces close and their content goes, then my own data, media and sign-in.
 */
app.delete('/me', rateLimit('delete-account', 5, 3600), async (c) => {
  const userId = c.get('userId');
  try {
    await deleteAccount(c.env, userId);
    return c.json({ ok: true });
  } catch (e) {
    console.error(JSON.stringify({ event: 'delete_account_failed', userId, error: String(e) }));
    return c.json({ error: 'Could not delete your account. Please try again.' }, 500);
  }
});

/** My referral code and how many couples I've brought in. */
app.get('/me/referral', async (c) => {
  try {
    return c.json(await referralSummary(c.env, c.get('userId')));
  } catch (e) {
    console.error(JSON.stringify({ event: 'referral_summary_failed', error: String(e) }));
    return c.json({ error: 'Something went wrong' }, 500);
  }
});

/** I opened someone's referral link: remember who invited me (credited when I pair). */
app.post('/referrals/claim', rateLimit('referral-claim', 10, 3600), async (c) => {
  const { code } = await c.req.json<{ code?: string }>().catch(() => ({ code: undefined }));
  try {
    return c.json(await claimReferral(c.env, c.get('userId'), String(code ?? '')));
  } catch (e) {
    if (e instanceof ApiError) return c.json({ error: e.message }, e.status as 400);
    console.error(JSON.stringify({ event: 'referral_claim_failed', error: String(e) }));
    return c.json({ error: 'Could not use that link' }, 500);
  }
});

/** Live availability check while the user types — does not claim the username. */
app.get('/username-available', rateLimit('username', 60, 60), async (c) => {
  const candidate = (c.req.query('u') ?? '').toLowerCase();
  if (!USERNAME_PATTERN.test(candidate)) {
    return c.json({ available: false, reason: 'invalid' });
  }

  const clerkClient = createClerkClient({ secretKey: c.env.CLERK_SECRET_KEY });
  const { data: matches } = await clerkClient.users.getUserList({ username: [candidate] });
  const taken = matches.some((u) => u.username?.toLowerCase() === candidate);

  return c.json({ available: !taken });
});

app.post('/me/avatar', rateLimit('avatar', 10, 600), async (c) => {
  const userId = c.get('userId');
  const body = await c.req.arrayBuffer();
  if (body.byteLength === 0) return c.json({ error: 'That photo came through empty. Please try again.' }, 400);
  if (body.byteLength > 15 * 1024 * 1024) return c.json({ error: 'That photo is too large. Try a smaller one.' }, 413);
  // Trust the bytes over the header: phones label photos loosely (or not at all).
  const image = resolveImageType(body, c.req.header('Content-Type'));
  if (!image) return c.json({ error: 'That file isn’t a photo we can use. Try a JPEG, PNG or HEIC.' }, 400);

  const key = `avatars/${userId}/${generateId()}.${image.ext}`;
  await c.env.STORAGE.put(key, body, { httpMetadata: { contentType: image.contentType } });

  const url = new URL(c.req.url);
  const avatarUrl = `${url.protocol}//${url.host}/media/${key}`;

  await c.env.DB.prepare('UPDATE users SET avatar_url = ?1 WHERE id = ?2').bind(avatarUrl, userId).run();
  const updated = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(userId).first();
  return c.json(updated);
});

app.post('/me/push-token', rateLimit('push-token', 30, 60), async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ token?: string | null }>();
  const token = typeof body.token === 'string' && body.token ? body.token : null;
  if (token && token.length > MAX_CHARS.pushToken) return c.json({ error: 'Invalid push token' }, 400);
  // One phone, one account (see register_push_token).
  if (token) {
    await c.env.DB.prepare('UPDATE users SET expo_push_token = NULL WHERE expo_push_token = ?1 AND id <> ?2')
      .bind(token, userId)
      .run();
  }
  await c.env.DB.prepare('UPDATE users SET expo_push_token = ?1, expo_push_token_updated_at = ?2 WHERE id = ?3')
    .bind(token, nowIso(), userId)
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
  const partnerRow = partnerId
    ? await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1').bind(partnerId).first<Record<string, unknown>>()
    : null;
  const partner = partnerRow ? publicProfile(partnerRow) : null;

  return c.json({ relationship, partner });
});

app.post('/relationships', rateLimit('space-create', 10, 3600), async (c) => {
  const userId = c.get('userId');
  type CreateRelationshipBody = { relationship_name?: string; anniversary_date?: string; relationship_type?: string };
  const body = await c.req.json<CreateRelationshipBody>().catch((): CreateRelationshipBody => ({}));
  const id = generateId();
  const inviteCode = newInviteCode();

  await c.env.DB.prepare(
    `INSERT INTO relationships (id, user_1_id, status, invite_code, relationship_name, anniversary_date, relationship_type)
     VALUES (?1, ?2, 'pending', ?3, ?4, ?5, ?6)`,
  )
    .bind(
      id,
      userId,
      inviteCode,
      body.relationship_name ?? 'Our Moments',
      body.anniversary_date ?? null,
      body.relationship_type ?? null,
    )
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

  const inviteCode = newInviteCode();
  await c.env.DB.prepare('UPDATE relationships SET invite_code = ?1 WHERE id = ?2')
    .bind(inviteCode, relationshipId)
    .run();
  return c.json({ invite_code: inviteCode });
});

/** Mirrors join_relationship_by_invite(): ends the caller's own pending space, joins the target one. */
app.post('/relationships/join', ipRateLimit('join', 30, 600), rateLimit('join', 10, 600), async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ inviteCode?: string }>().catch((): { inviteCode?: string } => ({}));
  let target: { relationshipId: string; inviterId: string };
  try {
    target = await joinWithInviteCode(c.env, userId, body.inviteCode);
  } catch (e) {
    if (e instanceof ApiError) return c.json({ error: e.message }, e.status as 400);
    throw e;
  }
  // If the joining partner already pays, their Plus now covers this couple.
  await carryPersonalPlus(c.env, userId, target.relationshipId);
  // Tell the inviter, and credit any referral that brought them here.
  await onPaired(c.env, target.relationshipId, userId, target.inviterId, (task) => c.executionCtx.waitUntil(task));

  const joined = await c.env.DB.prepare('SELECT * FROM relationships WHERE id = ?1').bind(target.relationshipId).first();
  const partnerRow = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?1')
    .bind(target.inviterId)
    .first<Record<string, unknown>>();
  // Your partner's profile, without their private columns (as everywhere else).
  return c.json({ relationship: joined, partner: partnerRow ? publicProfile(partnerRow) : null });
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

  await c.env.DB.prepare(`UPDATE relationships SET ${update.setClause} WHERE id = ?${update.values.length + 1}`)
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

  const before = c.req.query('before');
  const limit = Math.min(Math.max(Number(c.req.query('limit')) || 300, 1), 500);
  const { results } = await c.env.DB.prepare(
    `SELECT * FROM moments WHERE relationship_id = ?1 ${before ? 'AND created_at < ?3' : ''}
     ORDER BY created_at DESC LIMIT ?2`,
  )
    .bind(...(before ? [relationshipId, limit, before] : [relationshipId, limit]))
    .all();
  return c.json(results);
});

app.post('/relationships/:id/moments', rateLimit('moment', 30, 60), async (c) => {
  const userId = c.get('userId');
  const relationshipId = c.req.param('id');
  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json<{ id?: string; type?: string; media_url?: string; content?: string; mood?: string }>();
  // Saved already (a retry after a timeout): the same moment back, not a second one, and it
  // doesn't count against the day's allowance twice.
  const id = clientOrNewId(body.id);
  const replay = await findOwnRow(c.env, 'moments', id, relationshipId, 'user_id', userId);
  if (replay) return replay === 'taken' ? c.json({ error: 'That id is taken' }, 409) : c.json(replay, 200);

  let fields: { type: string; content: string | null; mediaUrl: string | null; mood: string | null };
  try {
    fields = {
      type: checkText(body.type, MAX_CHARS.kind, 'Type') ?? 'photo',
      content: checkText(body.content, MAX_CHARS.moment, 'Caption'),
      mediaUrl: checkText(body.media_url, MAX_CHARS.url, 'Media link'),
      mood: checkText(body.mood, MAX_CHARS.mood, 'Mood'),
    };
    await assertMomentAllowance(c.env, relationshipId, userId);
  } catch (e) {
    if (e instanceof ApiError) return c.json({ error: e.message, code: e.code }, e.status === 400 ? 400 : 402);
    throw e;
  }
  // Two copies of the same save at once: the second changes nothing.
  await c.env.DB.prepare(
    `INSERT INTO moments (id, relationship_id, user_id, type, content, media_url, mood) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
     ON CONFLICT (id) DO NOTHING`,
  )
    .bind(id, relationshipId, userId, fields.type, fields.content, fields.mediaUrl, fields.mood)
    .run();

  const created = await c.env.DB.prepare('SELECT * FROM moments WHERE id = ?1').bind(id).first();
  return c.json(created, 201);
});

app.post('/moments/:id/viewed', async (c) => {
  const userId = c.get('userId');
  const momentId = c.req.param('id');

  const moment = await c.env.DB.prepare('SELECT relationship_id FROM moments WHERE id = ?1')
    .bind(momentId)
    .first<{ relationship_id: string }>();
  if (!moment || !(await isRelationshipMember(c.env.DB, userId, moment.relationship_id))) {
    return c.json({ error: 'Moment not found' }, 404);
  }
  await updateJsonColumn<string[]>(c.env.DB, 'moments', 'viewed_by', momentId, [], (viewed) => withUser(viewed, userId));
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

app.post('/relationships/:id/messages', rateLimit('message', 120, 60), async (c) => {
  const userId = c.get('userId');
  const relationshipId = c.req.param('id');
  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json<{ id?: string; content?: string; media_url?: string; media_type?: string }>();
  // A retried send: the message already saved, not a second copy.
  const id = clientOrNewId(body.id);
  const replay = await findOwnRow(c.env, 'messages', id, relationshipId, 'sender_id', userId);
  if (replay) return replay === 'taken' ? c.json({ error: 'That id is taken' }, 409) : c.json(replay, 200);
  let fields: { content: string | null; mediaUrl: string | null; mediaType: string | null };
  try {
    fields = {
      content: checkText(body.content, MAX_CHARS.message, 'Message'),
      mediaUrl: checkText(body.media_url, MAX_CHARS.url, 'Media link'),
      mediaType: checkText(body.media_type, MAX_CHARS.kind, 'Media type'),
    };
  } catch (e) {
    if (e instanceof ApiError) return c.json({ error: e.message }, 400);
    throw e;
  }
  await c.env.DB.prepare(
    `INSERT INTO messages (id, relationship_id, sender_id, content, media_url, media_type) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT (id) DO NOTHING`,
  )
    .bind(id, relationshipId, userId, fields.content, fields.mediaUrl, fields.mediaType)
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
  const body = await c.req.json<{ emoji?: string }>();
  if (typeof body.emoji !== 'string' || !body.emoji || body.emoji.length > MAX_CHARS.emoji) {
    return c.json({ error: 'Invalid reaction' }, 400);
  }
  const emoji = body.emoji;

  const message = await c.env.DB.prepare('SELECT relationship_id FROM messages WHERE id = ?1')
    .bind(messageId)
    .first<{ relationship_id: string }>();
  if (!message || !(await isRelationshipMember(c.env.DB, userId, message.relationship_id))) {
    return c.json({ error: 'Message not found' }, 404);
  }
  // Both of you reacting at the same moment: neither reaction is lost.
  const updated = await updateJsonColumn<Record<string, string[]>>(c.env.DB, 'messages', 'reactions', messageId, {}, (current) =>
    toggleReaction(current, userId, emoji),
  );
  return c.json(parseJson<Record<string, string[]>>((updated?.reactions as string | null) ?? null, {}));
});

app.post('/messages/:id/hide', async (c) => {
  const userId = c.get('userId');
  const messageId = c.req.param('id');

  const message = await c.env.DB.prepare('SELECT relationship_id FROM messages WHERE id = ?1')
    .bind(messageId)
    .first<{ relationship_id: string }>();
  if (!message || !(await isRelationshipMember(c.env.DB, userId, message.relationship_id))) {
    return c.json({ error: 'Message not found' }, 404);
  }
  await updateJsonColumn<string[]>(c.env.DB, 'messages', 'hidden_for', messageId, [], (hidden) => withUser(hidden, userId));
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

app.post('/relationships/:id/moods', rateLimit('mood', 30, 60), async (c) => {
  const userId = c.get('userId');
  const relationshipId = c.req.param('id');
  if (!(await isRelationshipMember(c.env.DB, userId, relationshipId))) return c.json({ error: 'Forbidden' }, 403);

  const body = await c.req.json<{ mood?: string }>();
  if (typeof body.mood !== 'string' || !body.mood.trim()) return c.json({ error: 'Mood is required' }, 400);
  if (body.mood.length > MAX_CHARS.mood) return c.json({ error: 'Mood is too long' }, 400);

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

  let ids: string[];
  try {
    ids = checkIds(body.ids);
  } catch (e) {
    if (e instanceof ApiError) return c.json({ error: e.message }, 400);
    throw e;
  }
  const placeholders = ids.map((_, i) => `?${i + 2}`).join(', ');
  const result = await c.env.DB.prepare(
    `UPDATE notifications SET read = 1 WHERE user_id = ?1 AND read = 0 AND id IN (${placeholders})`,
  )
    .bind(userId, ...ids)
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

export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<PushRetry | JobMessage>, env: Env) {
    // Hourly jobs, a page of couples per message (jobs.ts).
    if (batch.queue === 'moments-jobs') return runJobPages(batch as MessageBatch<JobMessage>, env);
    // Pushes that failed the first time (Expo down, network blip): tried again with growing gaps.
    return retryPushes(batch as MessageBatch<PushRetry>, env);
  },
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    // Hourly: top up the emptiest shared content banks. Few AI calls per run keeps it inside the CPU limit.
    ctx.waitUntil(stockBanks(env, 6));
    // Birthday heads-ups, streak warnings and settling, restore reminders, mood check-ins: queued
    // a page of couples at a time, so they keep up however many couples there are.
    ctx.waitUntil(startHourlyJobs(env).catch((e) => console.error(JSON.stringify({ event: 'jobs_start_failed', error: String(e) }))));
    // Rate-limit windows older than a day are never read again: clear them so the table stays small.
    const dayAgo = Math.floor(Date.now() / 1000) - 86_400;
    ctx.waitUntil(
      env.DB.prepare('DELETE FROM rate_limits WHERE window_start < ?1')
        .bind(dayAgo)
        .run()
        .catch((e) => console.error(JSON.stringify({ event: 'rate_limit_cleanup_failed', error: String(e) }))),
    );
  },
} satisfies ExportedHandler<Env, PushRetry | JobMessage>;
