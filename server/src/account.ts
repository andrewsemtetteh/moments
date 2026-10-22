import { createClerkClient } from '@clerk/backend';

/**
 * Everything stored per shared space (relationship). When an account is
 * deleted its spaces close for both people (the same as "Leave relationship"),
 * so their content goes with them.
 */
const RELATIONSHIP_TABLES = [
  'moments',
  'messages',
  'activities',
  'daily_challenges',
  'calendar_events',
  'journal_entries',
  'mood_logs',
  'bucket_list',
  'shared_goals',
  'saved_experiences',
  'notifications',
  'streaks',
  'wrapped_stats',
  'analytics_events',
  'game_sessions',
  'streak_active_days',
  'user_streak_days',
  'user_streak_frozen_days',
  'notification_dedup',
  'quiz_live_sessions',
  'couple_progress',
  'pack_answers',
  'ai_usage',
  'ai_history',
  'content_cursor',
  'couple_docs',
] as const;

/** Rows that belong to the person themselves, wherever they are. */
const USER_TABLES: { table: string; column: string }[] = [
  { table: 'notifications', column: 'user_id' },
  { table: 'analytics_events', column: 'user_id' },
  { table: 'mood_logs', column: 'user_id' },
  { table: 'journal_entries', column: 'user_id' },
  { table: 'pack_answers', column: 'user_id' },
  { table: 'billing_events', column: 'app_user_id' },
  { table: 'user_streak_days', column: 'user_id' },
  { table: 'user_streak_frozen_days', column: 'user_id' },
  // Who invited whom: both sides go (the other person's credit has already been given).
  { table: 'referrals', column: 'referred_user_id' },
  { table: 'referrals', column: 'referrer_id' },
];

/** Shared-space media lives under `${bucket}/${relationshipId}/…`; profile media under the user's id. */
const SPACE_BUCKETS = ['moments', 'chat'];
const USER_PREFIXES = (userId: string) => [`profiles/${userId}/`, `avatars/${userId}/`];

async function deletePrefix(bucket: R2Bucket, prefix: string) {
  let cursor: string | undefined;
  do {
    const page = await bucket.list({ prefix, cursor, limit: 1000 });
    if (page.objects.length) await bucket.delete(page.objects.map((o) => o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
}

/** A table may not exist on every database (older ones), so skip ones that don't. */
async function existingTables(db: D1Database): Promise<Set<string>> {
  const { results } = await db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all<{ name: string }>();
  return new Set(results.map((r) => r.name));
}

/**
 * Permanently deletes an account: its shared spaces (and their content and
 * media), its own rows and profile media, the user row, and the Clerk sign-in.
 * Safe to retry: every step is a delete of whatever is still there.
 */
export async function deleteAccount(env: Env, userId: string): Promise<void> {
  const db = env.DB;
  const tables = await existingTables(db);

  const { results: spaces } = await db
    .prepare(`SELECT id FROM relationships WHERE user_1_id = ?1 OR user_2_id = ?1`)
    .bind(userId)
    .all<{ id: string }>();

  for (const { id } of spaces) {
    const statements = RELATIONSHIP_TABLES.filter((t) => tables.has(t)).map((t) =>
      db.prepare(`DELETE FROM ${t} WHERE relationship_id = ?1`).bind(id),
    );
    statements.push(db.prepare(`DELETE FROM relationships WHERE id = ?1`).bind(id));
    await db.batch(statements);
    for (const bucket of SPACE_BUCKETS) await deletePrefix(env.STORAGE, `${bucket}/${id}/`);
  }

  const own = USER_TABLES.filter(({ table }) => tables.has(table)).map(({ table, column }) =>
    db.prepare(`DELETE FROM ${table} WHERE ${column} = ?1`).bind(userId),
  );
  own.push(db.prepare(`DELETE FROM users WHERE id = ?1`).bind(userId));
  await db.batch(own);

  for (const prefix of USER_PREFIXES(userId)) await deletePrefix(env.STORAGE, prefix);

  // Last, so a failure above can be retried while they can still sign in.
  const clerk = createClerkClient({ secretKey: env.CLERK_SECRET_KEY });
  try {
    await clerk.users.deleteUser(userId);
  } catch (e) {
    // Already gone is fine; anything else should surface.
    const status = (e as { status?: number }).status;
    if (status !== 404) throw e;
  }
}
