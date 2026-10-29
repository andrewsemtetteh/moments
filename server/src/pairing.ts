import { ApiError, consumeRateLimit, createPartnerNotification, displayName } from './core';
import { generateId } from './db';
import { runFunction } from './functions';
import { creditReferralOnPairing } from './referrals';

/**
 * Joins the waiting space a code belongs to. The empty partner seat is taken all or nothing:
 * it must still be empty when the write lands, so two people entering the same code at once
 * can't both get it (the second used to silently replace the first). Only once the seat is
 * yours are your own waiting spaces closed. Rate limiting is the caller's.
 */
export async function joinWithInviteCode(
  env: Env,
  userId: string,
  rawCode: unknown,
): Promise<{ relationshipId: string; inviterId: string }> {
  const code = String(rawCode ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (code.length < 6 || code.length > 12) throw new ApiError('Invalid or expired invite code', 400);

  const target = await env.DB.prepare(
    `SELECT id, user_1_id FROM relationships WHERE invite_code = ?1 AND status = 'pending' AND user_2_id IS NULL LIMIT 1`,
  )
    .bind(code)
    .first<{ id: string; user_1_id: string }>();
  if (!target) throw new ApiError('Invalid or expired invite code', 404);
  if (target.user_1_id === userId) {
    throw new ApiError("That's your own code. Share it with your partner, or enter their code instead.", 400);
  }

  // The seat is yours: checked by the statements after the claim, in the same transaction.
  const seatIsMine = 'EXISTS (SELECT 1 FROM relationships WHERE id = ?2 AND user_2_id = ?1)';
  const [claim] = await env.DB.batch([
    env.DB.prepare(
      `UPDATE relationships SET user_2_id = ?1, status = 'active', invite_code = NULL
        WHERE id = ?2 AND user_2_id IS NULL AND status = 'pending'`,
    ).bind(userId, target.id),
    env.DB.prepare(
      `UPDATE relationships SET status = 'ended', invite_code = NULL, subscription_tier = 'free', subscription_owner_id = NULL
        WHERE user_1_id = ?1 AND user_2_id IS NULL AND status = 'pending' AND id <> ?2 AND ${seatIsMine}`,
    ).bind(userId, target.id),
    env.DB.prepare(`INSERT OR IGNORE INTO streaks (id, relationship_id) SELECT ?3, ?2 WHERE ${seatIsMine}`).bind(
      userId,
      target.id,
      generateId(),
    ),
  ]);
  if ((claim.meta.changes ?? 0) !== 1) {
    throw new ApiError('Someone just joined that space with this code. Ask your person for a new one.', 409);
  }
  return { relationshipId: target.id, inviterId: target.user_1_id };
}

/**
 * Everything that happens once two people are paired: the inviter hears about
 * it, and any referral that brought them in is credited. Never throws.
 */
export async function onPaired(
  env: Env,
  relationshipId: string,
  joinerId: string,
  inviterId: string,
  defer?: (task: Promise<unknown>) => void,
) {
  await notifyPartnerJoined(env, relationshipId, joinerId, inviterId, defer);
  try {
    await creditReferralOnPairing(env, relationshipId, [joinerId, inviterId]);
  } catch (e) {
    console.error(JSON.stringify({ event: 'referral_credit_failed', relationshipId, error: String(e) }));
  }
}

/**
 * Tell the person who shared the code that their partner just joined: a
 * notification in the app plus a push ("You're connected"). Never throws:
 * joining must succeed even if the notification can't be sent.
 */
export async function notifyPartnerJoined(
  env: Env,
  relationshipId: string,
  joinerId: string,
  inviterId: string,
  defer: (task: Promise<unknown>) => void = (task) => void task.catch(() => undefined),
) {
  try {
    const name = await displayName(env, joinerId);
    await createPartnerNotification(env, {
      relationshipId,
      recipientId: inviterId,
      type: 'partner_joined',
      content: `${name} joined your space. Say hi!`,
      relatedId: joinerId,
    });
    // Deliver now rather than waiting for the next app-triggered push.
    defer(runFunction(env, joinerId, 'send-push-notification', {}, consumeRateLimit, defer));
  } catch (e) {
    console.error(JSON.stringify({ event: 'partner_joined_notify_failed', relationshipId, error: String(e) }));
  }
}
