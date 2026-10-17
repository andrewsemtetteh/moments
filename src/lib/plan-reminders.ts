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
    const wanted = new Map<string, { at: Date; title: string; body: string }>();
    for (const event of events) {
      if (!remindsMe(event, myId)) continue;
      const meta = parsePlanMeta(event.description);
      const mins = meta.reminderMins;
      if (mins === null || mins === undefined) continue;
      const start = new Date(event.date_time);
      const at = new Date(start.getTime() - mins * 60_000);
      if (at.getTime() <= now + 30_000) continue;
      wanted.set(`${ID_PREFIX}${event.id}`, {
        at,
        title: event.title,
        body: `${leadLabel(mins) === 'now' ? 'Starting now' : `Starts ${leadLabel(mins)}`} · ${format(start, 'EEE d MMM, h:mm a')}${
          meta.location ? ` · ${meta.location}` : ''
        }`,
      });
    }
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
