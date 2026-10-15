import { Hono } from 'hono';

import { ApiError, consumeRateLimit, createPartnerNotification, displayName, emitRow, partnerOf } from './core';
import { runFunction } from './functions';
import { nowIso } from './db';
import './env';

// ---------------------------------------------------------------------------
// Moments Plus: one subscription per couple, bought through Superwall (App Store / Google Play).
// ---------------------------------------------------------------------------

/** Subscription columns only the server may write (the Superwall webhook). Clients can't set them. */
export const PROTECTED_COLUMNS = new Set([
  'subscription_tier',
  'subscription_owner_id',
  'subscription_expires_at',
  'subscription_period',
  'subscription_product',
  'billing_user_id',
  'billing_subscription_id',
  'billing_product_id',
  // Referrals: written by the server only, or anyone could give themselves Plus.
  'bonus_plus_until',
  'referral_code',
  'referred_by',
]);

/** Drops protected subscription columns from a client write. */
export function stripProtected<T extends Record<string, unknown>>(values: T): T {
  const out = { ...values };
  for (const key of Object.keys(out)) if (PROTECTED_COLUMNS.has(key)) delete out[key];
  return out;
}

type RelationshipPlus = {
  subscription_tier: string | null;
  subscription_owner_id: string | null;
  subscription_expires_at: string | null;
  subscription_period: string | null;
};

export type PlusState = { plus: boolean; trial: boolean; expiresAt: string | null };

export function plusStateOf(rel: RelationshipPlus | null | undefined): PlusState {
  // Referral bonus days (bonus_plus_until) count as Plus, whatever the store says.
  const bonus = (rel as { bonus_plus_until?: string | null } | null | undefined)?.bonus_plus_until;
  const paid = rel?.subscription_tier === 'plus' && !!rel?.subscription_owner_id;
  if (!paid && bonus && Date.parse(bonus) > Date.now()) return { plus: true, trial: false, expiresAt: bonus };
  if (!rel || rel.subscription_tier !== 'plus' || !rel.subscription_owner_id) {
    return { plus: false, trial: false, expiresAt: null };
  }
  const expiresAt = rel.subscription_expires_at;
  const active = !expiresAt || Date.parse(expiresAt) > Date.now();
  return { plus: active, trial: active && rel.subscription_period === 'trial', expiresAt };
}

export async function getPlusState(env: Env, relationshipId: string): Promise<PlusState> {
  const rel = await env.DB.prepare(
    'SELECT subscription_tier, subscription_owner_id, subscription_expires_at, subscription_period, bonus_plus_until FROM relationships WHERE id = ?1',
  )
    .bind(relationshipId)
    .first<RelationshipPlus>();
  return plusStateOf(rel);
}

/**
 * A person's own Plus follows them into the space they create or join (e.g. they subscribed on
 * their own empty space, which closes when they join their partner's). Only fills an empty slot:
 * a space that already has Plus keeps its payer.
 */
export async function carryPersonalPlus(env: Env, userId: string, relationshipId: string) {
  const user = await env.DB.prepare(
    'SELECT subscription_tier, subscription_expires_at, billing_product_id FROM users WHERE id = ?1',
  )
    .bind(userId)
    .first<{ subscription_tier: string | null; subscription_expires_at: string | null; billing_product_id: string | null }>();
  if (!user || user.subscription_tier !== 'plus') return;
  if (user.subscription_expires_at && Date.parse(user.subscription_expires_at) <= Date.now()) return;
  if ((await getPlusState(env, relationshipId)).plus) return;

  const row = await env.DB.prepare(
    `UPDATE relationships SET subscription_tier = 'plus', subscription_owner_id = ?2, subscription_expires_at = ?3,
     subscription_period = COALESCE(subscription_period, 'normal'), subscription_product = ?4 WHERE id = ?1 RETURNING *`,
  )
    .bind(relationshipId, userId, user.subscription_expires_at, user.billing_product_id)
    .first<Record<string, unknown>>();
  if (row) await emitRow(env, 'relationships', 'UPDATE', row);
}

// ---------------------------------------------------------------------------
// AI: free has none; Plus, free trial included, is unlimited within a generous monthly fair-use cap.
// ---------------------------------------------------------------------------

/** 'game' = Endless rounds and date ideas (per generation); 'question' = live quiz questions (per question). */
export type AiKind = 'game' | 'question';

/** Fair use per couple per calendar month (trial and paid alike). Far above normal use (~20 games a month). */
export const AI_MONTHLY_CAP: Record<AiKind, number> = { game: 200, question: 400 };

/**
 * Checks a couple may generate AI content now. Throws a 402 the app understands:
 * PLUS_REQUIRED (free) or AI_MONTHLY_CAP (fair use reached). The free trial gets the same AI as paying.
 * Returns the usage bucket to pass to `recordAi` once the generation succeeds (failed calls don't count).
 */
export async function checkAi(env: Env, relationshipId: string, kind: AiKind, amount = 1): Promise<string> {
  const state = await getPlusState(env, relationshipId);
  if (!state.plus) throw new ApiError('Moments Plus is needed for AI games and questions', 402, 'PLUS_REQUIRED');

  const periodKey = `month:${nowIso().slice(0, 7)}`;
  const limit = AI_MONTHLY_CAP[kind];

  const row = await env.DB.prepare('SELECT count FROM ai_usage WHERE relationship_id = ?1 AND period_key = ?2 AND kind = ?3')
    .bind(relationshipId, periodKey, kind)
    .first<{ count: number }>();
  const used = row?.count ?? 0;
  if (used + amount > limit) {
    throw new ApiError('You’ve reached this month’s AI limit. It resets next month.', 402, 'AI_MONTHLY_CAP');
  }
  return periodKey;
}

export async function recordAi(env: Env, relationshipId: string, periodKey: string, kind: AiKind, amount = 1) {
  await env.DB.prepare(
    `INSERT INTO ai_usage (relationship_id, period_key, kind, count, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (relationship_id, period_key, kind) DO UPDATE SET count = count + ?4, updated_at = ?5`,
  )
    .bind(relationshipId, periodKey, kind, amount, nowIso())
    .run();
}

// ---------------------------------------------------------------------------
// Who bought: the Superwall user id.
// ---------------------------------------------------------------------------

/**
 * The id the app identifies with in Superwall: a UUID derived from the Clerk id (StoreKit only
 * accepts a UUID as appAccountToken, and Superwall passes the identified id as that token).
 * Must match `billingUserId` in src/lib/purchases.ts exactly: SHA-1 of "moments-billing:<clerk id>",
 * first 16 bytes, RFC 4122 version 5 / variant bits, lowercase.
 */
export async function billingUserId(clerkUserId: string): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-1', new TextEncoder().encode(`moments-billing:${clerkUserId}`)),
  );
  const b = digest.slice(0, 16);
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Stores the person's Superwall id once, so the webhook can find them. No-op once set. */
export async function ensureBillingUserId(env: Env, userId: string, current: unknown) {
  if (typeof current === 'string' && current) return;
  await env.DB.prepare('UPDATE users SET billing_user_id = ?2 WHERE id = ?1 AND billing_user_id IS NULL')
    .bind(userId, await billingUserId(userId))
    .run();
}

// ---------------------------------------------------------------------------
// Superwall webhook: POST /webhooks/superwall
// https://superwall.com/docs/integrations/webhooks
// ---------------------------------------------------------------------------

type SuperwallEventData = {
  /** Unique per event (idempotency key). */
  id?: string;
  name?: string;
  /** TRIAL, INTRO or NORMAL. */
  periodType?: string;
  /** Milliseconds. Null for non-renewing purchases. */
  expirationAt?: number | null;
  originalTransactionId?: string;
  /** The id the buyer was identified with (our billing UUID), or `$SuperwallAlias:<uuid>` if anonymous. */
  originalAppUserId?: string | null;
  productId?: string;
  newProductId?: string | null;
  store?: string;
  environment?: string;
  bundleId?: string;
  /** Attributes set from the app; we set `clerkUserId`. */
  userAttributes?: Record<string, unknown> | null;
};

type SuperwallEvent = { object?: string; type?: string; data?: SuperwallEventData };

/** Events that mean "Plus is on, until expirationAt". */
const ACTIVE_EVENTS = new Set(['initial_purchase', 'renewal', 'uncancellation', 'product_change', 'non_renewing_purchase']);
/** Cancelling only stops the renewal: Plus stays until it expires, so nothing changes yet. */
const NO_CHANGE_EVENTS = new Set(['cancellation', 'billing_issue', 'subscription_paused']);

/** Our app's bundle / package; events for other apps in the same Superwall project are ignored. */
const BUNDLE_IDS = new Set(['com.vasemti.moments']);

/** The Clerk user behind an event: the `clerkUserId` attribute, else the billing UUID we identified with. */
async function resolveUserId(env: Env, data: SuperwallEventData): Promise<string | null> {
  const direct = [data.userAttributes?.clerkUserId, data.originalAppUserId].find(
    (id): id is string => typeof id === 'string' && id.startsWith('user_'),
  );
  if (direct) {
    const row = await env.DB.prepare('SELECT id FROM users WHERE id = ?1').bind(direct).first<{ id: string }>();
    if (row) return row.id;
  }
  const uuid = data.originalAppUserId?.replace(/^\$SuperwallAlias:/, '').toLowerCase();
  if (!uuid) return null;
  const row = await env.DB.prepare('SELECT id FROM users WHERE billing_user_id = ?1').bind(uuid).first<{ id: string }>();
  return row?.id ?? null;
}

async function activeRelationshipId(env: Env, userId: string): Promise<string | null> {
  const rel = await env.DB.prepare(
    `SELECT id FROM relationships WHERE (user_1_id = ?1 OR user_2_id = ?1) AND status != 'ended'
     ORDER BY created_at DESC LIMIT 1`,
  )
    .bind(userId)
    .first<{ id: string }>();
  return rel?.id ?? null;
}

/**
 * "Sam unlocked Moments Plus for you both": one plan covers the couple, so the
 * partner who didn't pay hears about it (in the app and as a push). Never throws.
 */
async function notifyPartnerUnlocked(env: Env, relationshipId: string, payerId: string, trial: boolean) {
  try {
    const partnerId = await partnerOf(env, relationshipId, payerId);
    if (!partnerId) return;
    const name = await displayName(env, payerId);
    await createPartnerNotification(env, {
      relationshipId,
      recipientId: partnerId,
      type: 'plus_unlocked',
      content: trial
        ? `${name} started a free Moments Plus trial for you both. Everything is unlocked.`
        : `${name} unlocked Moments Plus for you both. Everything is unlocked.`,
      relatedId: payerId,
    });
    await runFunction(env, payerId, 'send-push-notification', {}, consumeRateLimit, (task) => void task.catch(() => undefined));
  } catch (e) {
    console.error('plus unlocked notification failed', relationshipId, e);
  }
}

/** Applies one event. Returns the Clerk user it was about (for the audit row), or null if skipped. */
async function applyEvent(env: Env, type: string, data: SuperwallEventData): Promise<string | null> {
  if (NO_CHANGE_EVENTS.has(type)) return null;
  if (data.bundleId && !BUNDLE_IDS.has(data.bundleId)) return null;
  const userId = await resolveUserId(env, data);
  if (!userId) {
    console.warn('[superwall] no user for event', type, data.id, data.originalAppUserId);
    return null;
  }

  const relId = await activeRelationshipId(env, userId);
  const expiresAt = data.expirationAt ? new Date(data.expirationAt).toISOString() : null;
  const period = data.periodType === 'TRIAL' ? 'trial' : 'normal';
  const productId = (type === 'product_change' ? data.newProductId : null) ?? data.productId ?? null;

  if (ACTIVE_EVENTS.has(type)) {
    // A late delivery for a period that already ended must not switch Plus back on.
    if (expiresAt && Date.parse(expiresAt) <= Date.now()) return userId;
    await env.DB.prepare(
      `UPDATE users SET subscription_tier = 'plus', subscription_expires_at = ?2, billing_subscription_id = ?3,
       billing_product_id = ?4 WHERE id = ?1`,
    )
      .bind(userId, expiresAt, data.originalTransactionId ?? null, productId)
      .run();
    if (relId) {
      const row = await env.DB.prepare(
        `UPDATE relationships SET subscription_tier = 'plus', subscription_owner_id = ?2, subscription_expires_at = ?3,
         subscription_period = ?4, subscription_product = ?5 WHERE id = ?1 RETURNING *`,
      )
        .bind(relId, userId, expiresAt, period, productId)
        .first<Record<string, unknown>>();
      // Realtime: the partner's app unlocks straight away.
      if (row) await emitRow(env, 'relationships', 'UPDATE', row);
      // A new subscription (not a renewal): tell the partner it's theirs too.
      if (row && type === 'initial_purchase') await notifyPartnerUnlocked(env, relId, userId, period === 'trial');
    }
    return userId;
  }

  if (type === 'expiration') {
    // Events can arrive out of order: an older period expiring doesn't end a newer, renewed one.
    const user = await env.DB.prepare('SELECT subscription_expires_at FROM users WHERE id = ?1')
      .bind(userId)
      .first<{ subscription_expires_at: string | null }>();
    const current = user?.subscription_expires_at ? Date.parse(user.subscription_expires_at) : null;
    if (current && data.expirationAt && current > data.expirationAt + 60_000 && current > Date.now()) return userId;

    await env.DB.prepare(`UPDATE users SET subscription_tier = 'free', subscription_expires_at = NULL WHERE id = ?1`)
      .bind(userId)
      .run();
    // Only the payer's subscription ending turns the couple's Plus off.
    const row = await env.DB.prepare(
      `UPDATE relationships SET subscription_tier = 'free', subscription_owner_id = NULL, subscription_expires_at = NULL,
       subscription_period = NULL, subscription_product = NULL
       WHERE subscription_owner_id = ?1 AND status != 'ended' RETURNING *`,
    )
      .bind(userId)
      .first<Record<string, unknown>>();
    if (row) await emitRow(env, 'relationships', 'UPDATE', row);
  }
  return userId;
}

export const billingWebhooks = new Hono<{ Bindings: Env }>();

/** The Superwall entitlement that is Moments Plus (same id as the app's PLUS_ENTITLEMENT). */
export const PLUS_ENTITLEMENT = 'moments_unlimited';

/** Signed deliveries older or newer than this are rejected (stops replays). */
const SIGNATURE_TOLERANCE_S = 5 * 60;

/** Constant-time string compare (no early exit that leaks how much matched). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Superwall delivers through Svix: `svix-signature` holds space-separated `v1,<base64>` entries, each
 * HMAC-SHA256(base64-decoded secret after `whsec_`, "<svix-id>.<svix-timestamp>.<raw body>").
 * Checked over the raw bytes, before any JSON parsing.
 */
async function validSvixSignature(
  id: string | undefined,
  timestamp: string | undefined,
  signatures: string | undefined,
  rawBody: string,
  secret: string,
): Promise<boolean> {
  if (!id || !timestamp || !signatures) return false;
  const t = Number(timestamp);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > SIGNATURE_TOLERANCE_S) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${rawBody}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return signatures
    .split(' ')
    .map((entry) => entry.split(','))
    .some(([version, sig]) => version === 'v1' && !!sig && safeEqual(sig, expected));
}

billingWebhooks.post('/superwall', async (c) => {
  const secret = c.env.SUPERWALL_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: 'Webhook not configured' }, 503);

  const rawBody = await c.req.text();
  const signed = await validSvixSignature(
    c.req.header('svix-id'),
    c.req.header('svix-timestamp'),
    c.req.header('svix-signature'),
    rawBody,
    secret,
  );
  if (!signed) return c.json({ error: 'Bad signature' }, 401);

  const body = (() => {
    try {
      return JSON.parse(rawBody) as SuperwallEvent;
    } catch {
      return null;
    }
  })();
  const data = body?.data;
  const type = body?.type ?? data?.name;
  if (!type || !data) return c.json({ error: 'No event' }, 400);

  // Svix retries until it gets a 2xx; the event id keeps a retry from applying twice.
  const eventId = data.id ?? c.req.header('svix-id')!;
  const seen = await c.env.DB.prepare('SELECT id FROM billing_events WHERE id = ?1').bind(eventId).first();
  if (seen) return c.json({ ok: true, duplicate: true });

  const userId = await applyEvent(c.env, type, data);

  await c.env.DB.prepare('INSERT OR IGNORE INTO billing_events (id, type, app_user_id) VALUES (?1, ?2, ?3)')
    .bind(eventId, type, userId)
    .run();
  return c.json({ ok: true });
});
