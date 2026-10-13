import { Hono } from 'hono';

import { ApiError, emitRow } from './core';
import { nowIso } from './db';
import './env';

// ---------------------------------------------------------------------------
// Moments Plus: one subscription per couple, bought through RevenueCat.
// ---------------------------------------------------------------------------

/** Subscription columns only the server may write (the RevenueCat webhook). Clients can't set them. */
export const PROTECTED_COLUMNS = new Set([
  'subscription_tier',
  'subscription_owner_id',
  'subscription_expires_at',
  'subscription_period',
  'subscription_product',
  'revenuecat_customer_id',
  'revenuecat_subscription_id',
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
  // Referral bonus days (bonus_plus_until) count as Plus, whatever RevenueCat says.
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
    'SELECT subscription_tier, subscription_expires_at, revenuecat_subscription_id FROM users WHERE id = ?1',
  )
    .bind(userId)
    .first<{ subscription_tier: string | null; subscription_expires_at: string | null; revenuecat_subscription_id: string | null }>();
  if (!user || user.subscription_tier !== 'plus') return;
  if (user.subscription_expires_at && Date.parse(user.subscription_expires_at) <= Date.now()) return;
  if ((await getPlusState(env, relationshipId)).plus) return;

  const row = await env.DB.prepare(
    `UPDATE relationships SET subscription_tier = 'plus', subscription_owner_id = ?2, subscription_expires_at = ?3,
     subscription_period = COALESCE(subscription_period, 'normal'), subscription_product = ?4 WHERE id = ?1 RETURNING *`,
  )
    .bind(relationshipId, userId, user.subscription_expires_at, user.revenuecat_subscription_id)
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
// RevenueCat webhook: POST /webhooks/revenuecat
// https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields
// ---------------------------------------------------------------------------

type RevenueCatEvent = {
  id?: string;
  /** Entitlements this event is about; Moments only grants on `moments_unlimited`. */
  entitlement_ids?: string[] | null;
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  product_id?: string;
  period_type?: string;
  expiration_at_ms?: number | null;
  environment?: string;
};

/** Events that mean "Plus is on, until expiration_at_ms". */
const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'PRODUCT_CHANGE',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'TEMPORARY_ENTITLEMENT_GRANT',
  'REFUND_REVERSED',
]);
/** Cancelling only stops the renewal: Plus stays until it expires, so nothing changes yet. */
const NO_CHANGE_EVENTS = new Set(['CANCELLATION', 'BILLING_ISSUE', 'SUBSCRIPTION_PAUSED', 'TEST', 'TRANSFER']);

/** Clerk user ids look like user_…; RevenueCat anonymous ids ($RCAnonymousID…) are skipped. */
function clerkUserId(event: RevenueCatEvent): string | null {
  const candidates = [event.app_user_id, event.original_app_user_id, ...(event.aliases ?? [])];
  return candidates.find((id): id is string => typeof id === 'string' && id.startsWith('user_')) ?? null;
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

async function applyEvent(env: Env, event: RevenueCatEvent) {
  const type = event.type ?? '';
  if (NO_CHANGE_EVENTS.has(type)) return;
  // Only Moments Plus (other entitlements, if any are added later, don't unlock the couple).
  if (event.entitlement_ids?.length && !event.entitlement_ids.includes(PLUS_ENTITLEMENT)) return;
  const userId = clerkUserId(event);
  if (!userId) return;

  const relId = await activeRelationshipId(env, userId);
  const expiresAt = event.expiration_at_ms ? new Date(event.expiration_at_ms).toISOString() : null;
  const period = event.period_type === 'TRIAL' ? 'trial' : 'normal';

  if (ACTIVE_EVENTS.has(type)) {
    await env.DB.prepare(
      `UPDATE users SET subscription_tier = 'plus', subscription_expires_at = ?2, revenuecat_customer_id = ?3,
       revenuecat_subscription_id = ?4 WHERE id = ?1`,
    )
      .bind(userId, expiresAt, event.original_app_user_id ?? event.app_user_id ?? null, event.product_id ?? null)
      .run();
    if (relId) {
      const row = await env.DB.prepare(
        `UPDATE relationships SET subscription_tier = 'plus', subscription_owner_id = ?2, subscription_expires_at = ?3,
         subscription_period = ?4, subscription_product = ?5 WHERE id = ?1 RETURNING *`,
      )
        .bind(relId, userId, expiresAt, period, event.product_id ?? null)
        .first<Record<string, unknown>>();
      // Realtime: the partner's app unlocks straight away.
      if (row) await emitRow(env, 'relationships', 'UPDATE', row);
    }
    return;
  }

  if (type === 'EXPIRATION' || type === 'REFUND') {
    await env.DB.prepare(
      `UPDATE users SET subscription_tier = 'free', subscription_expires_at = NULL WHERE id = ?1`,
    )
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
}

export const billingWebhooks = new Hono<{ Bindings: Env }>();

/** The RevenueCat entitlement that is Moments Plus (same id as the app's PLUS_ENTITLEMENT). */
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

/**
 * RevenueCat HMAC signing: `X-RevenueCat-Webhook-Signature: t=<unix seconds>,v1=<hex>`, where v1 is
 * HMAC-SHA256(signing secret, "<t>.<raw body>"). Checked over the raw bytes, before any JSON parsing.
 */
async function validSignature(header: string | undefined, rawBody: string, signingSecret: string): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((p) => {
      const i = p.indexOf('=');
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    }),
  );
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1) return false;
  if (Math.abs(Date.now() / 1000 - t) > SIGNATURE_TOLERANCE_S) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(signingSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${parts.t}.${rawBody}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return safeEqual(expected, v1.toLowerCase());
}

billingWebhooks.post('/revenuecat', async (c) => {
  const secret = c.env.REVENUECAT_WEBHOOK_SECRET;
  // 1 · The Authorization header set in RevenueCat's webhook settings.
  if (!secret || !safeEqual(c.req.header('Authorization') ?? '', `Bearer ${secret}`)) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // 2 · HMAC signature, once a signing secret is set (REVENUECAT_WEBHOOK_SIGNING_SECRET).
  const rawBody = await c.req.text();
  const signingSecret = c.env.REVENUECAT_WEBHOOK_SIGNING_SECRET;
  if (signingSecret && !(await validSignature(c.req.header('X-RevenueCat-Webhook-Signature'), rawBody, signingSecret))) {
    return c.json({ error: 'Bad signature' }, 401);
  }

  const body = (() => {
    try {
      return JSON.parse(rawBody) as { event?: RevenueCatEvent };
    } catch {
      return null;
    }
  })();
  const event = body?.event;
  if (!event?.type) return c.json({ error: 'No event' }, 400);

  if (event.id) {
    const seen = await c.env.DB.prepare('SELECT id FROM billing_events WHERE id = ?1').bind(event.id).first();
    if (seen) return c.json({ ok: true, duplicate: true });
  }

  await applyEvent(c.env, event);

  if (event.id) {
    await c.env.DB.prepare('INSERT OR IGNORE INTO billing_events (id, type, app_user_id) VALUES (?1, ?2, ?3)')
      .bind(event.id, event.type, event.app_user_id ?? null)
      .run();
  }
  return c.json({ ok: true });
});
