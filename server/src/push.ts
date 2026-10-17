/**
 * Push delivery (Expo). A partner notification is pushed the moment the server
 * creates it, so nobody waits for an app to ask; `sendPendingPushes` is the
 * catch-up for anything that didn't go out (offline, Expo down).
 */

export function pushTitle(type: string): string {
  switch (type) {
    case 'message':
      return 'New message';
    case 'moment':
      return 'New moment';
    case 'mood':
    case 'mood_update':
      return 'Mood update';
    case 'streak':
      return 'Streak update';
    case 'challenge':
      return "Today's question";
    case 'game_invite':
      return 'Game time';
    case 'game_turn':
      return 'Your move';
    case 'call':
      return 'Incoming call';
    case 'achievement':
      return 'Achievement';
    case 'activity':
    case 'gratitude':
      return 'Moments';
    case 'calendar':
      return 'Plans';
    case 'partner_joined':
      return 'You’re connected';
    case 'referral_credit':
      return 'You earned Plus';
    case 'plus_unlocked':
    case 'plus_suggest':
      return 'Moments Plus';
    default:
      return 'Moments';
  }
}

/** Which Settings > Notifications switch covers each type. Keep in sync with src/lib/notification-prefs.ts. */
export const PUSH_CATEGORY: Record<string, string> = {
  message: 'messages',
  message_new: 'messages',
  moment: 'moments',
  mood: 'moods',
  mood_update: 'moods',
  challenge: 'dailyQuestion',
  streak: 'streaks',
  game_invite: 'games',
  game_turn: 'games',
  activity: 'activities',
  gratitude: 'activities',
  achievement: 'activities',
  calendar: 'plans',
  plus_suggest: 'plus',
};

export function pushAllowed(prefsRaw: string | null, type: string): boolean {
  const category = PUSH_CATEGORY[type];
  if (!category || !prefsRaw) return true;
  try {
    return (JSON.parse(prefsRaw) as Record<string, unknown>)[category] !== false;
  } catch {
    return true;
  }
}

type PushRow = { id: string; user_id: string; type: string; content: string; relationship_id: string };

/** Older than this, a missed push isn't worth sending any more (it's in the app's list). */
const PUSH_MAX_AGE_MS = 48 * 3600_000;

/**
 * Sends these notifications to their recipients' phones. Rows whose push is turned
 * off stay marked sent (they're in the in-app list); rows that failed to send are
 * released for the catch-up.
 */
async function deliver(env: Env, rows: PushRow[]): Promise<{ sent: number; skipped: number }> {
  if (rows.length === 0) return { sent: 0, skipped: 0 };
  const ids = [...new Set(rows.map((r) => r.user_id))];
  const { results: users } = await env.DB.prepare(
    `SELECT id, expo_push_token, notification_prefs FROM users WHERE id IN (${ids.map((_, i) => `?${i + 1}`).join(', ')})`,
  )
    .bind(...ids)
    .all<{ id: string; expo_push_token: string | null; notification_prefs: string | null }>();
  const tokens = new Map(users.filter((u) => u.expo_push_token).map((u) => [u.id, u.expo_push_token as string]));
  const prefs = new Map(users.map((u) => [u.id, u.notification_prefs]));

  const messages: Record<string, unknown>[] = [];
  let skipped = 0;
  for (const row of rows) {
    const token = tokens.get(row.user_id);
    if (!token || !pushAllowed(prefs.get(row.user_id) ?? null, row.type)) {
      skipped += 1;
      continue;
    }
    messages.push({
      to: token,
      title: pushTitle(row.type),
      body: row.content,
      sound: 'default',
      priority: 'high',
      ...(row.type === 'call' ? { channelId: 'calls', ttl: 45 } : {}),
      data: { notification_id: row.id, type: row.type, relationship_id: row.relationship_id },
    });
  }

  if (messages.length) {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    }).catch(() => null);
    if (!res?.ok) {
      const list = rows.map((r) => r.id);
      await env.DB.prepare(`UPDATE notifications SET push_dispatched = 0 WHERE id IN (${list.map((_, i) => `?${i + 1}`).join(', ')})`)
        .bind(...list)
        .run();
      return { sent: 0, skipped };
    }
  }
  return { sent: messages.length, skipped };
}

/** Push one notification right after it's created (claims it first, so it's never sent twice). */
export async function pushNotificationNow(env: Env, notificationId: string) {
  const { results } = await env.DB.prepare(
    `UPDATE notifications SET push_dispatched = 1 WHERE id = ?1 AND push_dispatched = 0
     RETURNING id, user_id, type, content, relationship_id`,
  )
    .bind(notificationId)
    .all<PushRow>();
  try {
    await deliver(env, results);
  } catch {
    // The catch-up sends it later.
    await env.DB.prepare('UPDATE notifications SET push_dispatched = 0 WHERE id = ?1').bind(notificationId).run();
  }
}

/**
 * Catch-up for this person's spaces: recent, unsent notifications whose recipient can
 * receive a push. Rows for someone without a push token are never picked, so they can't
 * take every slot and block their partner's pushes.
 */
export async function sendPendingPushes(env: Env, userId: string, max: number) {
  const since = new Date(Date.now() - PUSH_MAX_AGE_MS).toISOString();
  const { results: rows } = await env.DB.prepare(
    `UPDATE notifications SET push_dispatched = 1
     WHERE id IN (
       SELECT n.id FROM notifications n
       JOIN users u ON u.id = n.user_id AND u.expo_push_token IS NOT NULL
       WHERE n.push_dispatched = 0 AND n.read = 0 AND n.created_at >= ?3
         AND n.relationship_id IN (SELECT id FROM relationships WHERE user_1_id = ?1 OR user_2_id = ?1)
       ORDER BY n.created_at ASC LIMIT ?2)
     RETURNING id, user_id, type, content, relationship_id`,
  )
    .bind(userId, max, since)
    .all<PushRow>();
  return deliver(env, rows);
}
