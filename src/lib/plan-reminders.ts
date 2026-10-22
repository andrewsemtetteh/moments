import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { Platform } from 'react-native';

import { loadExpoNotifications } from '@/lib/expo-notifications-safe';
import { planOwner } from '@/lib/plan-day';
import { parsePlanMeta } from '@/lib/plan-meta';
import type { CalendarEvent } from '@/types/database';

/** Every plan reminder this phone schedules is named `plan-reminder:<plan id>`. */
const ID_PREFIX = 'plan-reminder:';
/** iOS keeps at most 64 pending local notifications for an app: leave room for the rest. */
const MAX_SCHEDULED = 40;

function leadLabel(mins: number): string {
  if (mins <= 0) return 'now';
  if (mins < 60) return `in ${mins} min`;
  if (mins < 24 * 60) {
    const h = Math.round(mins / 60);
    return `in ${h} hour${h === 1 ? '' : 's'}`;
  }
  const d = Math.round(mins / (24 * 60));
  return d === 1 ? 'tomorrow' : `in ${d} days`;
}

/** Missed reminders already sent late on this phone, so each goes out once only. */
const CAUGHT_UP_KEY = 'plan-reminders:caught-up';
async function loadCaughtUp(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(CAUGHT_UP_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}
async function saveCaughtUp(keys: Set<string>) {
  try {
    // Only the latest 200 (old plans are long gone).
    await AsyncStorage.setItem(CAUGHT_UP_KEY, JSON.stringify([...keys].slice(-200)));
  } catch {
    // ignore
  }
}

/** Whose phone a plan reminds: plans together remind both; your own plan only you. */
function remindsMe(event: CalendarEvent, myId: string): boolean {
  const owner = planOwner(event);
  return owner === 'together' || owner === myId;
}

/**
 * Keeps this phone's plan reminders matching the plans: a reminder for every upcoming plan
 * that has one (at its time minus the lead you picked), moved when a plan's time changes,
 * removed when the plan, or its reminder, goes. Safe to call as often as plans load.
 */
export async function syncPlanReminders(events: CalendarEvent[], myId: string): Promise<void> {
  const Notifications = loadExpoNotifications();
  if (!Notifications || Platform.OS === 'web') return;
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (!perm.granted) return;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('plans', {
        name: 'Plan reminders',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }

    const now = Date.now();
    const caughtUp = await loadCaughtUp();
    let caughtUpChanged = false;
    const wanted = new Map<string, { at: Date; title: string; body: string }>();
    for (const event of events) {
      if (!remindsMe(event, myId)) continue;
      const meta = parsePlanMeta(event.description);
      // Done already: nothing to remind about.
      if (meta.completed) continue;
      const mins = meta.reminderMins;
      if (mins === null || mins === undefined) continue;
      const start = new Date(event.date_time);
      let at = new Date(start.getTime() - mins * 60_000);
      let lead = mins;
      if (at.getTime() <= now + 30_000) {
        // The reminder's time has passed but the plan hasn't started: this phone never had it
        // scheduled (e.g. the app wasn't opened since the plan was made). Remind now, once,
        // with the time that's really left — unless the plan was only just made (you know).
        const key = `${event.id}@${event.date_time}@${mins}`;
        const minsLeft = Math.round((start.getTime() - now) / 60_000);
        const madeBeforeReminder = new Date(event.created_at).getTime() < at.getTime();
        if (minsLeft < 2 || !madeBeforeReminder || caughtUp.has(key)) continue;
        caughtUp.add(key);
        caughtUpChanged = true;
        at = new Date(now + 5_000);
        lead = minsLeft;
      }
      wanted.set(`${ID_PREFIX}${event.id}`, {
        at,
        title: event.title,
        body: `${leadLabel(lead) === 'now' ? 'Starting now' : `Starts ${leadLabel(lead)}`} · ${format(start, 'EEE d MMM, h:mm a')}${
          meta.location ? ` · ${meta.location}` : ''
        }`,
      });
    }
    if (caughtUpChanged) void saveCaughtUp(caughtUp);
    // Soonest first, within iOS's limit.
    const keep = [...wanted.entries()].sort((a, b) => a[1].at.getTime() - b[1].at.getTime()).slice(0, MAX_SCHEDULED);
    const keepIds = new Set(keep.map(([id]) => id));

    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    const existing = new Map(
      scheduled.filter((n) => n.identifier.startsWith(ID_PREFIX)).map((n) => [n.identifier, n] as const),
    );

    // Gone, or no longer wanted: cancel.
    await Promise.all(
      [...existing.keys()].filter((id) => !keepIds.has(id)).map((id) => Notifications.cancelScheduledNotificationAsync(id)),
    );

    for (const [identifier, r] of keep) {
      const current = existing.get(identifier) as { content?: { title?: string | null; body?: string | null } } | undefined;
      // Same time and words already scheduled: leave it.
      if (current && current.content?.title === r.title && current.content?.body === r.body) continue;
      await Notifications.scheduleNotificationAsync({
        identifier,
        content: { title: r.title, body: r.body, sound: 'default', data: { type: 'calendar' } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: r.at,
          ...(Platform.OS === 'android' ? { channelId: 'plans' } : {}),
        },
      });
    }
  } catch {
    // Best effort: the next sync tries again.
  }
}

/** Signing out: this phone stops reminding about that account's plans. */
export async function cancelPlanReminders(): Promise<void> {
  const Notifications = loadExpoNotifications();
  if (!Notifications) return;
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.identifier.startsWith(ID_PREFIX))
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // ignore
  }
}
