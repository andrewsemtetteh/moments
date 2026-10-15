import { consumeRateLimit, createPartnerNotification, displayName } from './core';
import { runFunction } from './functions';
import { creditReferralOnPairing } from './referrals';

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
    console.error('referral credit failed', relationshipId, e);
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
    console.error('partner joined notification failed', relationshipId, e);
  }
}
