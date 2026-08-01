import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { getAuthUser } from '../_shared/auth.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { enforceRateLimit, RATE_LIMITS, RateLimitError } from '../_shared/rate-limit.ts';

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound?: 'default';
  data?: Record<string, string>;
};

function pushTitle(type: string): string {
  switch (type) {
    case 'message':
      return 'New message';
    case 'moment':
      return 'New moment';
    case 'mood':
      return 'Mood update';
    case 'streak':
      return 'Streak update';
    case 'challenge':
      return "Today's question";
    case 'watch_party':
    case 'watch_party_nudge':
      return 'Watch Together';
    case 'watch_party_scheduled':
      return 'Movie night scheduled';
    default:
      return 'Moments';
  }
}

async function sendExpoPush(messages: ExpoPushMessage[]) {
  if (messages.length === 0) return;

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(messages),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Expo push failed: ${text}`);
  }
}

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  try {
    const { user, supabase: supabaseUser } = await getAuthUser(req);

    await enforceRateLimit(
      { functionName: 'send-push-notification', userId: user.id },
      RATE_LIMITS.sendPushNotification.maxHits,
      RATE_LIMITS.sendPushNotification.windowSeconds,
    );

    const body = await req.json().catch(() => ({}));
    const limit = typeof body.limit === 'number' ? body.limit : 10;

    const { data: claimed, error: claimError } = await supabaseUser.rpc('claim_push_notifications', {
      p_limit: limit,
    });
    if (claimError) throw claimError;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const rows = (claimed ?? []) as Array<{
      id: string;
      user_id: string;
      type: string;
      content: string;
      relationship_id: string;
    }>;

    if (rows.length === 0) {
      return jsonResponse({ sent: 0, skipped: 0 });
    }

    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, expo_push_token')
      .in('id', userIds);
    if (usersError) throw usersError;

    const tokenByUser = new Map(
      (users ?? [])
        .filter((u) => typeof u.expo_push_token === 'string' && u.expo_push_token.length > 0)
        .map((u) => [u.id, u.expo_push_token as string]),
    );

    const messages: ExpoPushMessage[] = [];
    const skippedIds: string[] = [];

    for (const row of rows) {
      const token = tokenByUser.get(row.user_id);
      if (!token) {
        skippedIds.push(row.id);
        continue;
      }

      messages.push({
        to: token,
        title: pushTitle(row.type),
        body: row.content,
        sound: 'default',
        data: {
          notification_id: row.id,
          type: row.type,
          relationship_id: row.relationship_id,
        },
      });
    }

    if (messages.length > 0) {
      try {
        await sendExpoPush(messages);
      } catch (pushError) {
        const claimedIds = rows.map((row) => row.id);
        await supabase
          .from('notifications')
          .update({ push_dispatched: false })
          .in('id', claimedIds);
        throw pushError;
      }
    }

    if (skippedIds.length > 0) {
      await supabase
        .from('notifications')
        .update({ push_dispatched: false })
        .in('id', skippedIds);
    }

    return jsonResponse({ sent: messages.length, skipped: skippedIds.length });
  } catch (e) {
    if (e instanceof RateLimitError) {
      return jsonResponse({ sent: 0, skipped: 0, error: e.message, rate_limited: true });
    }
    const message = e instanceof Error ? e.message : 'Unknown error';
    console.error('send-push-notification failed:', message);
    return jsonResponse({ sent: 0, skipped: 0, error: message });
  }
});
