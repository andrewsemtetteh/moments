import { createPartnerNotification, tryNotificationDedup } from './core';
import { onlyCouples } from './db';
import './env';

/** Sent from this hour (the partner's local time) on the day before. */
const HEADS_UP_HOUR = 9;

type Row = {
  relationship_id: string;
  birthday_user_id: string;
  birthday_name: string | null;
  birthday: string;
  partner_id: string;
  partner_timezone: string | null;
};

/** Date (YYYY-MM-DD) and hour where this person is; UTC when their timezone is unknown. */
function localNow(timeZone: string | null, now: Date): { day: string; hour: number } {
  const zone = timeZone?.trim() || 'UTC';
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
    return { day: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) };
  } catch {
    return { day: now.toISOString().slice(0, 10), hour: now.getUTCHours() };
  }
}

function addDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isLeap(year: number) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Is `day` (YYYY-MM-DD) this birthday? 29 Feb is celebrated on 28 Feb in other years. */
function isBirthdayOn(birthday: string, day: string): boolean {
  const md = birthday.slice(5, 10);
  const year = Number(day.slice(0, 4));
  if (md === '02-29' && !isLeap(year)) return day.slice(5, 10) === '02-28';
  return day.slice(5, 10) === md;
}

/**
 * Hourly (the cron): the day before someone's birthday, from 9am where their partner
 * is, their partner gets a notification (in the app's list and as a push). Once a year,
 * guarded by the dedup table.
 */
export async function sendBirthdayHeadsUps(env: Env, now = new Date(), relIds?: string[]): Promise<number> {
  const page = onlyCouples(relIds, 1);
  const { results } = await env.DB.prepare(
    `SELECT r.id AS relationship_id, b.id AS birthday_user_id, b.name AS birthday_name, b.birthday,
            p.id AS partner_id, p.timezone AS partner_timezone
     FROM relationships r
     JOIN users b ON b.id IN (r.user_1_id, r.user_2_id)
     JOIN users p ON p.id IN (r.user_1_id, r.user_2_id) AND p.id <> b.id
     WHERE r.status = 'active' AND b.birthday IS NOT NULL AND length(b.birthday) = 10${page.sql}`,
  )
    .bind(...page.binds)
    .all<Row>();

  let sent = 0;
  for (const row of results ?? []) {
    const { day, hour } = localNow(row.partner_timezone, now);
    if (hour < HEADS_UP_HOUR) continue;
    const tomorrow = addDay(day);
    if (!isBirthdayOn(row.birthday, tomorrow)) continue;

    const year = tomorrow.slice(0, 4);
    if (!(await tryNotificationDedup(env, row.relationship_id, `birthday-eve:${row.birthday_user_id}:${year}`))) continue;

    const name = row.birthday_name?.trim().split(/\s+/)[0] || 'Your person';
    const age = Number(year) - Number(row.birthday.slice(0, 4));
    const turning = age > 0 && age < 130 ? ` They turn ${age}.` : '';
    const id = await createPartnerNotification(env, {
      relationshipId: row.relationship_id,
      recipientId: row.partner_id,
      type: 'birthday',
      content: `${name}’s birthday is tomorrow 🎂${turning} Plan something special.`,
      relatedId: row.birthday_user_id,
    });
    if (id) sent++;
  }
  return sent;
}
