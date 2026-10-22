import { signMediaInText } from './media-sign';
import { daysToFreeze, FREEZE_EVERY_DAYS, MAX_STREAK_FREEZES } from './streak-freeze';
import { pushNotificationNow } from './push';
import { afterResponse } from './request-context';
import type { HubEvent } from './hub';
import { generateId, nowIso, relationshipIdsForUser } from './db';
import './env';

export const BOOL_COLUMNS = new Set([
  'is_pinned',
  'deleted_for_all',
  'read',
  'push_dispatched',
  'completed',
  'distance_mode',
  'location_sharing_enabled',
  'show_online_status',
  'is_private',
]);

export const JSON_COLUMNS = new Set([
  'reactions',
  'viewed_by',
  'hidden_for',
  'payload',
  'metadata',
  'questions',
  'responses',
  'scores',
  'stats',
  'badges',
  'quests',
  'mood_summary',
  'highlights',
  'state',
  'notification_prefs',
]);

/**
 * Profile columns only the person themselves (and the server) may see. A partner sees your
 * name, photo, location (when shared), status and time zone, never your email, push token,
 * billing or referral ids, or notification settings.
 */
const PRIVATE_USER_COLUMNS = [
  'email',
  'expo_push_token',
  'expo_push_token_updated_at',
  'billing_user_id',
  'billing_subscription_id',
  'billing_product_id',
  'revenuecat_customer_id',
  'revenuecat_subscription_id',
  'referral_code',
  'referred_by',
  'notification_prefs',
];

/** A user row as someone else (their partner) may see it. */
export function publicProfile<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const key of PRIVATE_USER_COLUMNS) delete out[key];
  return out as T;
}

/** SQLite row -> the JSON shape the app's Postgres-era types expect (booleans, parsed JSON). */
export function shapeRow<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const [key, value] of Object.entries(out)) {
    if (BOOL_COLUMNS.has(key) && (typeof value === 'number' || value === null)) {
      out[key] = value === 1;
    } else if (JSON_COLUMNS.has(key) && typeof value === 'string') {
      try {
        out[key] = JSON.parse(value);
      } catch {
        /* leave as-is */
      }
    }
  }
  return out as T;
}

/** App value -> SQLite bind value. */
export function toBind(key: string, value: unknown): unknown {
  if (value === undefined) return null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value !== null && typeof value === 'object') return JSON.stringify(value);
  if (JSON_COLUMNS.has(key) && typeof value === 'string') return value;
  return value;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ---------------------------------------------------------------------------
// Realtime fan-out
// ---------------------------------------------------------------------------

export async function emitToRelationship(env: Env, relationshipId: string, event: HubEvent) {
  const send = async () => {
    try {
      const stub = env.HUB.get(env.HUB.idFromName(relationshipId));
      // Media links in live updates are signed like everything else the server sends.
      const body = await signMediaInText(env, JSON.stringify(event));
      await stub.fetch('https://hub/notify', { method: 'POST', body });
    } catch {
      /* realtime is best-effort */
    }
  };
  // Sent right after the answer, so whoever saved (a message, a plan, a moment) isn't kept
  // waiting on the other phone's live update.
  await afterResponse(send());
}

/** Emit a row change to whichever relationship rooms should see it. */
export async function emitRow(
  env: Env,
  table: string,
  eventType: HubEvent['eventType'],
  row: Record<string, unknown> | null,
  old: Record<string, unknown> | null = null,
) {
  const shaped = row ? shapeRow(row) : null;
  const shapedOld = old ? shapeRow(old) : null;
  const source = shaped ?? shapedOld;
  if (!source) return;

  const event: HubEvent = {
    table,
    eventType,
    new: shaped && table === 'users' ? publicProfile(shaped) : shaped,
    old: shapedOld && table === 'users' ? publicProfile(shapedOld) : shapedOld,
  };
  if (table === 'notifications' && typeof source.user_id === 'string') event.userId = source.user_id;

  if (table === 'users' && typeof source.id === 'string') {
    for (const relId of await relationshipIdsForUser(env.DB, source.id)) {
      await emitToRelationship(env, relId, event);
    }
    return;
  }

  const relId = table === 'relationships' ? source.id : source.relationship_id;
  if (typeof relId === 'string') await emitToRelationship(env, relId, event);
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function createPartnerNotification(
  env: Env,
  args: {
    relationshipId: string;
    recipientId: string;
    type: string;
    content: string;
    mediaUrl?: string | null;
    relatedId?: string | null;
  },
): Promise<string | null> {
  if (!args.type.trim() || !args.content.trim()) return null;

  const member = await env.DB.prepare(
    `SELECT 1 FROM relationships WHERE id = ?1 AND status = 'active' AND (user_1_id = ?2 OR user_2_id = ?2)`,
  )
    .bind(args.relationshipId, args.recipientId)
    .first();
  if (!member) return null;

  const id = generateId();
  const row = await env.DB.prepare(
    `INSERT INTO notifications (id, relationship_id, user_id, type, content, media_url, related_id)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7) RETURNING *`,
  )
    .bind(id, args.relationshipId, args.recipientId, args.type, args.content, args.mediaUrl ?? null, args.relatedId ?? null)
    .first<Record<string, unknown>>();
  // The in-app ping and the push to their phone go out right after the answer: the sender
  // (sending a moment, a plan, a nudge…) doesn't wait on Expo's push service.
  if (row) {
    void afterResponse(
      emitRow(env, 'notifications', 'INSERT', row).then(() => pushNotificationNow(env, id)),
    );
  }
  return id;
}

export async function tryNotificationDedup(env: Env, relationshipId: string, key: string): Promise<boolean> {
  const result = await env.DB.prepare(
    'INSERT OR IGNORE INTO notification_dedup (relationship_id, dedup_key) VALUES (?1, ?2)',
  )
    .bind(relationshipId, key)
    .run();
  return result.meta.changes > 0;
}

export async function partnerOf(env: Env, relationshipId: string, userId: string): Promise<string | null> {
  const rel = await env.DB.prepare(
    `SELECT user_1_id, user_2_id FROM relationships WHERE id = ?1 AND status = 'active'`,
  )
    .bind(relationshipId)
    .first<{ user_1_id: string; user_2_id: string | null }>();
  if (!rel) return null;
  if (rel.user_1_id === userId) return rel.user_2_id;
  if (rel.user_2_id === userId) return rel.user_1_id;
  return null;
}

const MOOD_LABELS: Record<string, string> = { missing: 'Missing you' };

export function moodLabel(mood: string): string {
  const key = mood.toLowerCase();
  if (MOOD_LABELS[key]) return MOOD_LABELS[key];
  const spaced = key.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export async function displayName(env: Env, userId: string): Promise<string> {
  const row = await env.DB.prepare('SELECT name FROM users WHERE id = ?1').bind(userId).first<{ name: string | null }>();
  return row?.name?.trim() || 'Your partner';
}

// ---------------------------------------------------------------------------
// Streaks
//
// Individual, like Paired: each partner has their own streak, kept by their own daily
// check-in (a moment, a mood, or answering today's question). Only you can lose yours.
// The couple columns (current_streak, longest_streak, last_active_date) are the
// "together" streak: days you BOTH showed up. The status sent to the app puts YOUR
// streak in current_streak / longest_streak / at_risk / active_days (what every screen
// shows), with the together streak and your partner's alongside.
// ---------------------------------------------------------------------------

const RESTORE_WINDOW_MS = 24 * 60 * 60 * 1000;

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Today as a calendar date where this person is (their synced timezone), so streak days
 * line up with the week and month the app draws in local time. UTC when unknown.
 */
async function localToday(env: Env, userId: string | null | undefined): Promise<string> {
  if (!userId) return todayStr();
  const row = await env.DB.prepare('SELECT timezone FROM users WHERE id = ?1').bind(userId).first<{ timezone: string | null }>();
  const timeZone = row?.timezone?.trim();
  if (!timeZone) return todayStr();
  try {
    // en-CA formats as YYYY-MM-DD.
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  } catch {
    return todayStr();
  }
}

/** The hour (0–23) it is now for this person, in their own timezone (UTC when unknown). */
async function localHour(env: Env, userId: string): Promise<number> {
  const row = await env.DB.prepare('SELECT timezone FROM users WHERE id = ?1').bind(userId).first<{ timezone: string | null }>();
  const timeZone = row?.timezone?.trim() || 'UTC';
  try {
    const h = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(new Date());
    return Number(h) % 24;
  } catch {
    return new Date().getUTCHours();
  }
}

/** "Streak at risk" goes out once this few hours (or fewer) are left before their midnight. */
export const STREAK_RISK_NOTIFY_HOURS = 3;

/**
 * Your streak ends tonight (kept yesterday, not yet today) and it's the last few hours of your
 * day: tell you once, in the app and on your phone. Not before — a warning at breakfast for
 * something due at midnight just gets ignored.
 */
async function notifyStreakRiskIfDue(
  env: Env,
  relationshipId: string,
  userId: string,
  streak: number,
  today: string,
) {
  if ((await localHour(env, userId)) < 24 - STREAK_RISK_NOTIFY_HOURS) return;
  if (!(await tryNotificationDedup(env, relationshipId, `streak_risk:${userId}:${today}`))) return;
  await createPartnerNotification(env, {
    relationshipId,
    recipientId: userId,
    type: 'streak',
    content: `Your ${streak}-day streak ends in less than ${STREAK_RISK_NOTIFY_HOURS} hours. Send a moment, share your mood, answer today’s question or play a game to keep it.`,
  });
}

/** The mood ask goes out in the day only (their time), never at night. */
const MOOD_CHECKIN_FROM_HOUR = 10;
const MOOD_CHECKIN_UNTIL_HOUR = 21;

/**
 * Hourly (cron): anyone whose last mood is more than a day old is asked how they're feeling —
 * in the app and on their phone — once a day, in the daytime their time. Only people who've
 * shared a mood before (the ask is "share it again", not a first-time nudge).
 */
export async function sendMoodCheckins(env: Env): Promise<number> {
  const dayAgo = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { results } = await env.DB.prepare(
    `SELECT m.relationship_id, m.user_id, MAX(m.created_at) AS last_at
       FROM mood_logs m JOIN relationships r ON r.id = m.relationship_id
      WHERE r.status = 'active' AND (m.user_id = r.user_1_id OR m.user_id = r.user_2_id)
      GROUP BY m.relationship_id, m.user_id
     HAVING MAX(m.created_at) < ?1`,
  )
    .bind(dayAgo)
    .all<{ relationship_id: string; user_id: string; last_at: string }>();
  let sent = 0;
  for (const row of results ?? []) {
    const hour = await localHour(env, row.user_id);
    if (hour < MOOD_CHECKIN_FROM_HOUR || hour >= MOOD_CHECKIN_UNTIL_HOUR) continue;
    const today = await localToday(env, row.user_id);
    if (!(await tryNotificationDedup(env, row.relationship_id, `mood_checkin:${row.user_id}:${today}`))) continue;
    await createPartnerNotification(env, {
      relationshipId: row.relationship_id,
      recipientId: row.user_id,
      type: 'mood_checkin',
      content: 'It’s been a day since your last mood. How are you feeling? Share it so your partner knows.',
    });
    sent += 1;
  }
  return sent;
}

/**
 * Hourly (cron): everyone in their last hours of the day whose streak ends tonight gets the
 * warning, even if they haven't opened the app this evening.
 */
export async function sendStreakRiskReminders(env: Env): Promise<number> {
  const { results } = await env.DB.prepare(
    `SELECT r.id AS relationship_id, r.user_1_id, r.user_2_id,
            s.user_1_streak, s.user_2_streak, s.user_1_last_active_date, s.user_2_last_active_date
       FROM relationships r JOIN streaks s ON s.relationship_id = r.id
      WHERE r.status = 'active' AND (s.user_1_streak > 0 OR s.user_2_streak > 0)`,
  ).all<{
    relationship_id: string;
    user_1_id: string | null;
    user_2_id: string | null;
    user_1_streak: number;
    user_2_streak: number;
    user_1_last_active_date: string | null;
    user_2_last_active_date: string | null;
  }>();
  let sent = 0;
  for (const r of results ?? []) {
    for (const side of ['user_1', 'user_2'] as const) {
      const userId = r[`${side}_id`];
      const streak = r[`${side}_streak`];
      if (!userId || streak <= 0) continue;
      const today = await localToday(env, userId);
      // Kept yesterday, not yet today: it ends at their midnight.
      if (r[`${side}_last_active_date`] !== shiftDay(today, -1)) continue;
      await notifyStreakRiskIfDue(env, r.relationship_id, userId, streak, today);
      sent += 1;
    }
  }
  return sent;
}

function shiftDay(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

type StreakRow = {
  id: string;
  relationship_id: string;
  current_streak: number;
  longest_streak: number;
  last_active_date: string | null;
  user_1_last_active_date: string | null;
  user_2_last_active_date: string | null;
  restorable_streak: number | null;
  restorable_lost_at: string | null;
  user_1_streak: number;
  user_1_longest: number;
  user_1_restorable: number | null;
  user_1_lost_at: string | null;
  user_2_streak: number;
  user_2_longest: number;
  user_2_restorable: number | null;
  user_2_lost_at: string | null;
  user_1_freezes: number;
  user_2_freezes: number;
};



/** Which side of the row is this person (user_1 or user_2). */
type Side = 'user_1' | 'user_2';

async function ensureStreakRow(env: Env, relationshipId: string): Promise<StreakRow> {
  await env.DB.prepare('INSERT OR IGNORE INTO streaks (id, relationship_id) VALUES (?1, ?2)')
    .bind(generateId(), relationshipId)
    .run();
  return (await env.DB.prepare('SELECT * FROM streaks WHERE relationship_id = ?1')
    .bind(relationshipId)
    .first<StreakRow>())!;
}

async function relationshipMembers(env: Env, relationshipId: string) {
  return env.DB.prepare('SELECT user_1_id, user_2_id, status, subscription_tier FROM relationships WHERE id = ?1')
    .bind(relationshipId)
    .first<{ user_1_id: string; user_2_id: string | null; status: string; subscription_tier: string }>();
}

/** Tells both phones the streak row changed (realtime), so every screen shows the same numbers. */
async function emitStreakRow(env: Env, relationshipId: string) {
  const row = await env.DB.prepare('SELECT * FROM streaks WHERE relationship_id = ?1')
    .bind(relationshipId)
    .first<Record<string, unknown>>();
  if (row) await emitRow(env, 'streaks', 'UPDATE', row);
}

/**
 * Ends any streak that missed a day: each person's own (theirs alone, restorable with
 * Plus for 24 hours, and they're told), and the together streak (just resets).
 */
async function normalizeStreaksIfBroken(
  env: Env,
  relationshipId: string,
  rel: { user_1_id: string; user_2_id: string | null },
) {
  const row = await ensureStreakRow(env, relationshipId);
  let changed = false;

  for (const side of ['user_1', 'user_2'] as const) {
    const userId = side === 'user_1' ? rel.user_1_id : rel.user_2_id;
    if (!userId) continue;
    const today = await localToday(env, userId);
    const last = row[`${side}_last_active_date`];
    const count = row[`${side}_streak`];
    if (count > 0 && (!last || last < shiftDay(today, -1))) {
      // A freeze (or two) covers the missed days: the streak carries on, frozen on those days.
      const frozen = daysToFreeze(last, today, row[`${side}_freezes`] ?? 0);
      if (frozen && frozen.length) {
        const yesterday = shiftDay(today, -1);
        await env.DB.batch([
          env.DB.prepare(
            `UPDATE streaks SET ${side}_freezes = ${side}_freezes - ?1, ${side}_last_active_date = ?2, updated_at = ?3
             WHERE relationship_id = ?4`,
          ).bind(frozen.length, yesterday, nowIso(), relationshipId),
          ...frozen.map((day) =>
            env.DB.prepare(
              'INSERT OR IGNORE INTO user_streak_frozen_days (relationship_id, user_id, frozen_date) VALUES (?1, ?2, ?3)',
            ).bind(relationshipId, userId, day),
          ),
        ]);
        row[`${side}_freezes`] -= frozen.length;
        row[`${side}_last_active_date`] = yesterday;
        changed = true;
        if (await tryNotificationDedup(env, relationshipId, `streak_frozen:${userId}:${today}`)) {
          await createPartnerNotification(env, {
            relationshipId,
            recipientId: userId,
            type: 'streak',
            content: `A streak freeze kept your ${count}-day streak safe. Check in today to keep it going.`,
          });
        }
        continue;
      }
      await env.DB.prepare(
        `UPDATE streaks SET ${side}_restorable = ?1, ${side}_lost_at = ?2, ${side}_streak = 0, updated_at = ?2
         WHERE relationship_id = ?3`,
      )
        .bind(count, nowIso(), relationshipId)
        .run();
      changed = true;
      if (await tryNotificationDedup(env, relationshipId, `streak_lost:${userId}:${today}`)) {
        await createPartnerNotification(env, {
          relationshipId,
          recipientId: userId,
          type: 'streak',
          content: `Your ${count}-day streak ended. Plus members can restore it within 24 hours.`,
        });
      }
    }
    // The restore window closed.
    const lostAt = row[`${side}_lost_at`];
    if (lostAt && new Date(lostAt).getTime() <= Date.now() - RESTORE_WINDOW_MS) {
      await env.DB.prepare(
        `UPDATE streaks SET ${side}_restorable = NULL, ${side}_lost_at = NULL
         WHERE relationship_id = ?1 AND ${side}_streak = 0`,
      )
        .bind(relationshipId)
        .run();
    }
  }

  // Together: a day you didn't both show up ends it (no restore for this one).
  const togetherToday = await localToday(env, rel.user_1_id);
  if (row.current_streak > 0 && (!row.last_active_date || row.last_active_date < shiftDay(togetherToday, -1))) {
    await env.DB.batch([
      env.DB.prepare('UPDATE streaks SET current_streak = 0, updated_at = ?1 WHERE relationship_id = ?2').bind(
        nowIso(),
        relationshipId,
      ),
      env.DB.prepare('UPDATE relationships SET streak_count = 0 WHERE id = ?1').bind(relationshipId),
    ]);
    changed = true;
  }

  // Both phones drop together, not just the one that noticed.
  if (changed) await emitStreakRow(env, relationshipId);
}

/**
 * A daily check-in from `userId` (a moment, a mood, or their answer to today's question;
 * null = both of you at once). Keeps their own streak going, and once you've BOTH shown
 * up today, the together streak too.
 */
export async function updateStreak(env: Env, relationshipId: string, userId: string | null) {
  const rel = await relationshipMembers(env, relationshipId);
  if (!rel || rel.status !== 'active') return;
  if (userId && userId !== rel.user_1_id && userId !== rel.user_2_id) return;

  const row = await ensureStreakRow(env, relationshipId);
  const sides: Side[] =
    userId === null ? ['user_1', 'user_2'] : [userId === rel.user_1_id ? 'user_1' : 'user_2'];

  // Each person's own streak, on their own calendar day.
  for (const side of sides) {
    const personId = side === 'user_1' ? rel.user_1_id : rel.user_2_id;
    if (!personId) continue;
    const today = await localToday(env, personId);
    const last = row[`${side}_last_active_date`];
    if (last === today) continue;
    const next = last === shiftDay(today, -1) ? row[`${side}_streak`] + 1 : 1;
    row[`${side}_streak`] = next;
    row[`${side}_longest`] = Math.max(row[`${side}_longest`], next);
    // Every 7 days of streak earns a freeze (up to 2 held).
    if (next % FREEZE_EVERY_DAYS === 0) {
      row[`${side}_freezes`] = Math.min(MAX_STREAK_FREEZES, (row[`${side}_freezes`] ?? 0) + 1);
    }
    row[`${side}_last_active_date`] = today;
    if (last !== shiftDay(today, -1)) {
      // A fresh start: the old streak can't be restored any more.
      row[`${side}_restorable`] = null;
      row[`${side}_lost_at`] = null;
    }
    await env.DB.prepare('INSERT OR IGNORE INTO user_streak_days (relationship_id, user_id, activity_date) VALUES (?1, ?2, ?3)')
      .bind(relationshipId, personId, today)
      .run();
  }

  // Together: each of you has checked in on your own today (so a couple in different
  // time zones still counts). The together day is dated by the first partner's calendar,
  // the same one the break check uses.
  const today1 = await localToday(env, rel.user_1_id);
  const today2 = rel.user_2_id ? await localToday(env, rel.user_2_id) : today1;
  const today = today1;
  const bothToday = row.user_1_last_active_date === today1 && row.user_2_last_active_date === today2;
  if (bothToday && row.last_active_date !== today) {
    row.current_streak = row.last_active_date === shiftDay(today, -1) ? row.current_streak + 1 : 1;
    row.longest_streak = Math.max(row.longest_streak, row.current_streak);
    row.last_active_date = today;
    await env.DB.prepare('INSERT OR IGNORE INTO streak_active_days (relationship_id, activity_date) VALUES (?1, ?2)')
      .bind(relationshipId, today)
      .run();
  }

  await env.DB.batch([
    env.DB.prepare(
      `UPDATE streaks SET current_streak = ?1, longest_streak = ?2, last_active_date = ?3,
         user_1_last_active_date = ?4, user_2_last_active_date = ?5,
         user_1_streak = ?6, user_1_longest = ?7, user_1_restorable = ?8, user_1_lost_at = ?9,
         user_2_streak = ?10, user_2_longest = ?11, user_2_restorable = ?12, user_2_lost_at = ?13,
         updated_at = ?14, user_1_freezes = ?16, user_2_freezes = ?17
       WHERE relationship_id = ?15`,
    ).bind(
      row.current_streak,
      row.longest_streak,
      row.last_active_date,
      row.user_1_last_active_date,
      row.user_2_last_active_date,
      row.user_1_streak,
      row.user_1_longest,
      row.user_1_restorable,
      row.user_1_lost_at,
      row.user_2_streak,
      row.user_2_longest,
      row.user_2_restorable,
      row.user_2_lost_at,
      nowIso(),
      relationshipId,
      row.user_1_freezes ?? 0,
      row.user_2_freezes ?? 0,
    ),
    env.DB.prepare('UPDATE relationships SET streak_count = ?1 WHERE id = ?2').bind(row.current_streak, relationshipId),
  ]);

  await emitStreakRow(env, relationshipId);
}

export async function getStreakStatus(env: Env, relationshipId: string, userId: string) {
  const rel = await relationshipMembers(env, relationshipId);
  if (rel) await normalizeStreaksIfBroken(env, relationshipId, rel);
  const row = await ensureStreakRow(env, relationshipId);
  const today = await localToday(env, userId);
  const yesterday = shiftDay(today, -1);

  const mySide: Side = rel?.user_2_id === userId ? 'user_2' : 'user_1';
  const theirSide: Side = mySide === 'user_1' ? 'user_2' : 'user_1';
  const partnerId = mySide === 'user_1' ? rel?.user_2_id : rel?.user_1_id;
  const partnerToday = partnerId ? await localToday(env, partnerId) : today;

  const mine = row[`${mySide}_last_active_date`];
  const theirs = row[`${theirSide}_last_active_date`];
  const myStreak = row[`${mySide}_streak`];
  const theirStreak = row[`${theirSide}_streak`];
  const myRestorable = row[`${mySide}_restorable`];
  const myLostAt = row[`${mySide}_lost_at`];

  // Your streak ends tonight: you kept it yesterday, not yet today.
  const atRisk = myStreak > 0 && mine === yesterday;
  const partnerAtRisk = theirStreak > 0 && theirs === shiftDay(partnerToday, -1);
  const canRestore =
    myStreak === 0 &&
    (myRestorable ?? 0) > 0 &&
    !!myLostAt &&
    new Date(myLostAt).getTime() > Date.now() - RESTORE_WINDOW_MS;

  // Only in the last few hours of their day (see notifyStreakRiskIfDue); the hourly job covers it too.
  if (atRisk) await notifyStreakRiskIfDue(env, relationshipId, userId, myStreak, today);

  const [myDays, togetherDays, myFrozen] = await Promise.all([
    env.DB.prepare(
      'SELECT activity_date FROM user_streak_days WHERE relationship_id = ?1 AND user_id = ?2 ORDER BY activity_date ASC',
    )
      .bind(relationshipId, userId)
      .all<{ activity_date: string }>(),
    env.DB.prepare('SELECT activity_date FROM streak_active_days WHERE relationship_id = ?1 ORDER BY activity_date ASC')
      .bind(relationshipId)
      .all<{ activity_date: string }>(),
    env.DB.prepare(
      'SELECT frozen_date FROM user_streak_frozen_days WHERE relationship_id = ?1 AND user_id = ?2 ORDER BY frozen_date ASC',
    )
      .bind(relationshipId, userId)
      .all<{ frozen_date: string }>(),
  ]);

  return {
    relationship_id: relationshipId,
    // Yours: what every screen shows.
    current_streak: myStreak,
    longest_streak: row[`${mySide}_longest`],
    last_active_date: mine,
    at_risk: atRisk,
    can_restore_streak: canRestore,
    restorable_streak: canRestore ? myRestorable : null,
    restorable_lost_at: canRestore ? myLostAt : null,
    active_days: myDays.results.map((r) => r.activity_date),
    user_active_today: mine === today,
    // Streak freezes you hold, and the days one covered (drawn frozen on the calendar).
    streak_freezes: row[`${mySide}_freezes`] ?? 0,
    frozen_days: myFrozen.results.map((r) => r.frozen_date),
    // Your partner's.
    partner_streak: theirStreak,
    partner_longest_streak: row[`${theirSide}_longest`],
    partner_active_today: theirs === partnerToday,
    partner_at_risk: partnerAtRisk,
    // Together: days you both showed up.
    together_streak: row.current_streak,
    together_longest_streak: row.longest_streak,
    together_days: togetherDays.results.map((r) => r.activity_date),
    both_active_today: mine === today && theirs === partnerToday,
  };
}

/** Plus: bring back YOUR streak within 24 hours of it ending (your partner's is theirs). */
export async function restoreStreak(env: Env, relationshipId: string, userId: string) {
  const rel = await relationshipMembers(env, relationshipId);
  if (!rel) throw new ApiError('Relationship not found', 404);
  const { getPlusState } = await import('./billing');
  if (!(await getPlusState(env, relationshipId)).plus) throw new ApiError('Plus required to restore streaks', 403);

  await normalizeStreaksIfBroken(env, relationshipId, rel);
  const row = await ensureStreakRow(env, relationshipId);
  const side: Side = rel.user_2_id === userId ? 'user_2' : 'user_1';
  const restorable = row[`${side}_restorable`];
  const lostAt = row[`${side}_lost_at`];
  if (row[`${side}_streak`] !== 0 || !restorable || restorable <= 0) {
    throw new ApiError('No restorable streak available', 400);
  }
  if (!lostAt || new Date(lostAt).getTime() <= Date.now() - RESTORE_WINDOW_MS) {
    throw new ApiError('Restore window expired', 400);
  }

  // Back as if you'd checked in yesterday: today's check-in keeps it going.
  const today = await localToday(env, userId);
  await env.DB.prepare(
    `UPDATE streaks SET ${side}_streak = ?1, ${side}_last_active_date = ?2, ${side}_restorable = NULL, ${side}_lost_at = NULL,
       ${side}_longest = MAX(${side}_longest, ?1), updated_at = ?3 WHERE relationship_id = ?4`,
  )
    .bind(restorable, shiftDay(today, -1), nowIso(), relationshipId)
    .run();
  await emitStreakRow(env, relationshipId);
  return getStreakStatus(env, relationshipId, userId);
}

// ---------------------------------------------------------------------------
// Rate limiting (replaces edge_rate_limits / consume_rate_limit)
// ---------------------------------------------------------------------------

/** The in-memory limiter for "N a minute", when there's one for that N (see wrangler.jsonc). */
function fastLimiter(env: Env, maxHits: number, windowSeconds: number): RateLimit | undefined {
  if (windowSeconds !== 60) return undefined;
  return maxHits === 30 ? env.RL_30_PER_MIN : maxHits === 60 ? env.RL_60_PER_MIN : maxHits === 120 ? env.RL_120_PER_MIN : undefined;
}

export async function consumeRateLimit(env: Env, bucket: string, maxHits: number, windowSeconds: number) {
  // Busy per-minute limits (uploads, messages, moments, shared docs, media links): Cloudflare's
  // in-memory limiter — no database write on every call. The rare, exact ones (joining, account
  // deletion, referrals…) stay counted in D1 below.
  const fast = fastLimiter(env, maxHits, windowSeconds);
  if (fast) {
    const { success } = await fast.limit({ key: bucket });
    if (!success) throw new ApiError('Too many requests. Please try again later.', 429);
    return;
  }
  const windowStart = Math.floor(Date.now() / 1000 / windowSeconds) * windowSeconds;
  const row = await env.DB.prepare(
    `INSERT INTO rate_limits (bucket_key, window_start, hits) VALUES (?1, ?2, 1)
     ON CONFLICT (bucket_key, window_start) DO UPDATE SET hits = hits + 1 RETURNING hits`,
  )
    .bind(bucket, windowStart)
    .first<{ hits: number }>();
  if ((row?.hits ?? 1) > maxHits) throw new ApiError('Too many requests. Please try again later.', 429);
}
