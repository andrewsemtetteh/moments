import { addDays, addMonths, setHours, setMinutes, startOfDay } from 'date-fns';

import { getAnniversaryCountdown } from '@/lib/anniversary';
import { loadExpoNotifications } from '@/lib/expo-notifications-safe';

/**
 * Local reminders for the days that matter, scheduled on each phone so both
 * of you get them (and they still fire offline):
 *   · your anniversary, and a heads-up a week before
 *   · month-versaries through the first year
 *   · day-count milestones (100, 365, 500, 1,000 days…)
 *   · "your Wrapped is ready" on 1 December
 * Everything is re-planned whenever this runs (app start, date change), so an
 * edited anniversary never leaves a stale reminder behind.
 */

const PREFIX = 'rel-';
const AT_HOUR = 9;
const DAY_MILESTONES = [100, 200, 300, 365, 500, 730, 1000, 1095, 1461, 1500, 1826, 2000, 2500, 3000, 3653, 5000];

type Reminder = { id: string; date: Date; title: string; body: string; type: string };

function at9(day: Date) {
  return setMinutes(setHours(startOfDay(day), AT_HOUR), 0);
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

export function buildRelationshipReminders({
  anniversaryIso,
  partnerName,
  now = new Date(),
}: {
  anniversaryIso: string;
  partnerName: string;
  now?: Date;
}): Reminder[] {
  const { anniversaryDate, togetherSince } = getAnniversaryCountdown(anniversaryIso);
  const list: Reminder[] = [];
  const years = anniversaryDate.getFullYear() - togetherSince.getFullYear();

  // Anniversary + a week's notice.
  list.push({
    id: 'anniversary',
    date: at9(anniversaryDate),
    title: `Happy anniversary 💞`,
    body: `${plural(years, 'year')} with ${partnerName} today. Make it a good one.`,
    type: 'anniversary',
  });
  list.push({
    id: 'anniversary-week',
    date: at9(addDays(anniversaryDate, -7)),
    title: 'Your anniversary is in a week',
    body: `${plural(years, 'year')} together next week. Maybe plan something special?`,
    type: 'anniversary',
  });

  // Month-versaries in the first year.
  for (let m = 1; m <= 11; m++) {
    const day = addMonths(togetherSince, m);
    if (at9(day) > now) {
      list.push({
        id: `month-${m}`,
        date: at9(day),
        title: `${plural(m, 'month')} together`,
        body: `Happy ${m}-month-versary with ${partnerName} 💕`,
        type: 'milestone',
      });
      break; // only the next one; it re-plans on the next app open
    }
  }

  // The next two day-count milestones.
  DAY_MILESTONES.map((n) => ({ n, day: addDays(togetherSince, n) }))
    .filter(({ day }) => at9(day) > now)
    .slice(0, 2)
    .forEach(({ n, day }) =>
      list.push({
        id: `days-${n}`,
        date: at9(day),
        title: `${n.toLocaleString()} days together 🎉`,
        body: `You and ${partnerName} hit ${n.toLocaleString()} days today. Share it?`,
        type: 'milestone',
      }),
    );

  // Wrapped season.
  const wrappedDay = at9(new Date(now.getFullYear(), 11, 1));
  list.push({
    id: `wrapped-${now.getFullYear()}`,
    date: wrappedDay,
    title: `Your ${now.getFullYear()} Wrapped is ready`,
    body: `See your year with ${partnerName}: moments, streaks, game nights and more.`,
    type: 'wrapped',
  });

  return list.filter((r) => r.date > now);
}

/** Replace all scheduled relationship reminders. Quietly does nothing without permission. */
export async function syncRelationshipReminders(args: { anniversaryIso: string; partnerName: string }) {
  const Notifications = loadExpoNotifications();
  if (!Notifications) return;
  try {
    const permission = await Notifications.getPermissionsAsync();
    if (!permission.granted) return;

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );

    for (const r of buildRelationshipReminders(args)) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${r.id}`,
        content: { title: r.title, body: r.body, data: { type: r.type }, sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date },
      });
    }
  } catch {
    // Unsupported runtime or the OS refused; reminders are a nice-to-have.
  }
}
