// NOTE: expo-notifications throws at import time inside Expo Go (SDK 53+ removed
// remote-notification support there), so it is loaded lazily and defensively.
// Local scheduled reminders still work in a development/production build.

type NotificationsModule = typeof import('expo-notifications');

function loadNotifications(): NotificationsModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications') as NotificationsModule;
  } catch {
    return null;
  }
}

/**
 * Schedule a local reminder before a watch session. Returns the notification id
 * (or null if it couldn't be scheduled, e.g. unsupported runtime, permission
 * denied, or the time has already passed). Failures are swallowed so scheduling
 * a party never throws.
 */
export async function scheduleWatchReminder(opts: {
  title: string;
  scheduledAt: Date;
  reminderMinutes: number;
}): Promise<string | null> {
  const Notifications = loadNotifications();
  if (!Notifications) return null;

  try {
    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) {
      const req = await Notifications.requestPermissionsAsync();
      if (!req.granted) return null;
    }

    const fireAt = new Date(opts.scheduledAt.getTime() - opts.reminderMinutes * 60_000);
    if (fireAt.getTime() <= Date.now()) return null;

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Movie night soon 🍿',
        body: `${opts.title} starts ${formatLead(opts.reminderMinutes)}. Get the snacks ready!`,
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
  } catch {
    return null;
  }
}

export async function cancelWatchReminder(notificationId: string | null | undefined) {
  if (!notificationId) return;
  const Notifications = loadNotifications();
  if (!Notifications) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
  } catch {
    // ignore
  }
}

function formatLead(minutes: number): string {
  if (minutes <= 0) return 'now';
  if (minutes >= 2880) return 'in 2 days';
  if (minutes >= 1440) return 'tomorrow';
  if (minutes >= 360) return `in ${Math.round(minutes / 60)} hours`;
  if (minutes >= 60) return `in ${Math.round(minutes / 60)} hour${minutes >= 120 ? 's' : ''}`;
  return `in ${minutes} minutes`;
}
