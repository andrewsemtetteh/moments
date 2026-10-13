import { ApiError, createPartnerNotification } from './core';
import { generateId, nowIso } from './db';

/** Days of Plus each couple gets when an invited couple pairs (matches REFERRAL_DAYS in the app). */
export const REFERRAL_DAYS = 14;
/** Most referral credits one person can earn in a year (keeps it fair). */
const MAX_CREDITS_PER_YEAR = 12;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

function randomCode(length = 7) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

/** The person's referral code, made on first ask. */
export async function getOrCreateReferralCode(env: Env, userId: string): Promise<string> {
  const row = await env.DB.prepare('SELECT referral_code FROM users WHERE id = ?1')
    .bind(userId)
    .first<{ referral_code: string | null }>();
  if (row?.referral_code) return row.referral_code;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    const res = await env.DB.prepare(
      'UPDATE users SET referral_code = ?1 WHERE id = ?2 AND referral_code IS NULL AND NOT EXISTS (SELECT 1 FROM users WHERE referral_code = ?1)',
    )
      .bind(code, userId)
      .run();
    if (res.meta.changes > 0) return code;
    const again = await env.DB.prepare('SELECT referral_code FROM users WHERE id = ?1')
      .bind(userId)
      .first<{ referral_code: string | null }>();
    if (again?.referral_code) return again.referral_code;
  }
  throw new ApiError('Could not make a referral code. Please try again.', 500);
}

export async function referralSummary(env: Env, userId: string) {
  const code = await getOrCreateReferralCode(env, userId);
  const row = await env.DB.prepare(
    'SELECT COUNT(*) AS credited FROM referrals WHERE referrer_id = ?1 AND credited_at IS NOT NULL',
  )
    .bind(userId)
    .first<{ credited: number }>();
  return { code, credited: row?.credited ?? 0, days: REFERRAL_DAYS };
}

/**
 * Someone opened a referral link: remember who invited them. Only for people
 * not yet paired with a partner (it's for new couples), once, and never your own code.
 */
export async function claimReferral(env: Env, userId: string, rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9]{5,12}$/.test(code)) throw new ApiError('That referral link isn’t valid.');
  const referrer = await env.DB.prepare('SELECT id FROM users WHERE referral_code = ?1')
    .bind(code)
    .first<{ id: string }>();
  if (!referrer) throw new ApiError('That referral link isn’t valid.');
  if (referrer.id === userId) throw new ApiError('That’s your own link. Share it with another couple.');

  const me = await env.DB.prepare('SELECT referred_by FROM users WHERE id = ?1')
    .bind(userId)
    .first<{ referred_by: string | null }>();
  if (me?.referred_by) return { ok: true, already: true };

  const paired = await env.DB.prepare(
    `SELECT 1 FROM relationships WHERE status = 'active' AND user_2_id IS NOT NULL AND (user_1_id = ?1 OR user_2_id = ?1)`,
  )
    .bind(userId)
    .first();
  if (paired) throw new ApiError('Referral links are for new couples.');

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET referred_by = ?1 WHERE id = ?2 AND referred_by IS NULL').bind(referrer.id, userId),
    env.DB.prepare('INSERT OR IGNORE INTO referrals (id, referrer_id, referred_user_id) VALUES (?1, ?2, ?3)').bind(
      generateId(),
      referrer.id,
      userId,
    ),
  ]);
  return { ok: true, already: false };
}

/** Adds days of bonus Plus to a space, on top of any bonus it already has. */
async function addBonusDays(env: Env, relationshipId: string, days: number) {
  const row = await env.DB.prepare('SELECT bonus_plus_until FROM relationships WHERE id = ?1')
    .bind(relationshipId)
    .first<{ bonus_plus_until: string | null }>();
  const from = Math.max(Date.now(), row?.bonus_plus_until ? Date.parse(row.bonus_plus_until) : 0);
  const until = new Date(from + days * 86_400_000).toISOString();
  await env.DB.prepare('UPDATE relationships SET bonus_plus_until = ?1 WHERE id = ?2').bind(until, relationshipId).run();
}

/**
 * A couple just paired. If either of them came from someone's referral link,
 * the new couple and the referrer's couple each get REFERRAL_DAYS of Plus
 * (once per new couple), and the referrer is told.
 */
export async function creditReferralOnPairing(env: Env, relationshipId: string, memberIds: string[]) {
  const { results } = await env.DB.prepare(
    `SELECT id, referrer_id, referred_user_id FROM referrals
     WHERE credited_at IS NULL AND referred_user_id IN (${memberIds.map((_, i) => `?${i + 1}`).join(', ')})`,
  )
    .bind(...memberIds)
    .all<{ id: string; referrer_id: string; referred_user_id: string }>();

  // A couple can't refer itself.
  const pending = results.filter((r) => !memberIds.includes(r.referrer_id));
  if (pending.length === 0) return;

  let newCoupleCredited = false;
  for (const r of pending) {
    const yearAgo = new Date(Date.now() - 365 * 86_400_000).toISOString();
    const count = await env.DB.prepare(
      'SELECT COUNT(*) AS n FROM referrals WHERE referrer_id = ?1 AND credited_at > ?2',
    )
      .bind(r.referrer_id, yearAgo)
      .first<{ n: number }>();
    const referrerSpace = await env.DB.prepare(
      `SELECT id FROM relationships WHERE status <> 'ended' AND (user_1_id = ?1 OR user_2_id = ?1) ORDER BY created_at DESC LIMIT 1`,
    )
      .bind(r.referrer_id)
      .first<{ id: string }>();

    if (!newCoupleCredited) {
      await addBonusDays(env, relationshipId, REFERRAL_DAYS);
      newCoupleCredited = true;
    }
    if (referrerSpace && (count?.n ?? 0) < MAX_CREDITS_PER_YEAR) {
      await addBonusDays(env, referrerSpace.id, REFERRAL_DAYS);
      await createPartnerNotification(env, {
        relationshipId: referrerSpace.id,
        recipientId: r.referrer_id,
        type: 'referral_credit',
        content: `A couple you invited just joined Moments. You both got ${REFERRAL_DAYS} days of Plus!`,
      });
    }
    await env.DB.prepare('UPDATE referrals SET credited_at = ?1, relationship_id = ?2 WHERE id = ?3')
      .bind(nowIso(), relationshipId, r.id)
      .run();
  }
}
