import { Platform } from 'react-native';

import { localCalendarDate } from '@/lib/db-time';
import { loadExpoNotifications } from '@/lib/expo-notifications-safe';
import {
  needsStreakReminders,
  STREAK_NUDGE_HOURS_BEFORE_MIDNIGHT,
  STREAK_WARN_HOURS_BEFORE_MIDNIGHT,
  streakReminderFireAt,
} from '@/lib/streak-reminder-timing';
import type { StreakStatus } from '@/types/database';

export {
  isStreakVisuallyAtRisk,
  msUntilLocalMidnight,
  needsStreakReminders,
  shouldShowStreakAtRiskCard,
  STREAK_NUDGE_HOURS_BEFORE_MIDNIGHT,
  STREAK_WARN_HOURS_BEFORE_MIDNIGHT,
  streakReminderFireAt,
} from '@/lib/streak-reminder-timing';

const WARN_ID_PREFIX = 'streak-warn-3h:';
const NUDGE_ID_PREFIX = 'streak-nudge-1h:';

function loadNotifications() {
  return loadExpoNotifications();
}

function warnIdentifier(day: string) {
  return `${WARN_ID_PREFIX}${day}`;
}

function nudgeIdentifier(day: string) {
  return `${NUDGE_ID_PREFIX}${day}`;
}

async function ensureStreakChannel(
  Notifications: NonNullable<ReturnType<typeof loadNotifications>>,
) {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('streaks', {
    name: 'Streak reminders',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

async function cancelStreakReminderIds(
  Notifications: NonNullable<ReturnType<typeof loadNotifications>>,
) {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => {
          const id = n.identifier;
          return id.startsWith(WARN_ID_PREFIX) || id.startsWith(NUDGE_ID_PREFIX);
        })
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // ignore
  }
}

export async function cancelStreakReminders(): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  await cancelStreakReminderIds(Notifications);
}

/**
 * Schedules today's 3h warning and 1h nudge when the streak is at risk and
 * this user still needs to check in. Cancels otherwise.
 */
export async function syncStreakReminders(
  status: StreakStatus,
  now = new Date(),
): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;

  try {
    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) {
      await cancelStreakReminderIds(Notifications);
      return;
    }

    await cancelStreakReminderIds(Notifications);

    if (!needsStreakReminders(status)) return;

    await ensureStreakChannel(Notifications);

    const day = localCalendarDate(now);
    const count = status.current_streak;
    const streakLabel = count === 1 ? '1 day streak' : `${count} day streak`;
    const androidChannel = Platform.OS === 'android' ? { channelId: 'streaks' as const } : {};

    const warnAt = streakReminderFireAt(STREAK_WARN_HOURS_BEFORE_MIDNIGHT, now);
    if (warnAt) {
      await Notifications.scheduleNotificationAsync({
        identifier: warnIdentifier(day),
        content: {
          title: 'Streak at risk',
          body: `Your ${streakLabel} ends in 3 hours. Check in to keep it going.`,
          data: { type: 'streak', kind: 'warn' },
          ...androidChannel,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: warnAt,
        },
      });
    }

    const nudgeAt = streakReminderFireAt(STREAK_NUDGE_HOURS_BEFORE_MIDNIGHT, now);
    if (nudgeAt) {
      await Notifications.scheduleNotificationAsync({
        identifier: nudgeIdentifier(day),
        content: {
          title: 'Last chance',
          body: `Your ${streakLabel} ends in 1 hour. Check in before midnight.`,
          data: { type: 'streak', kind: 'nudge' },
          ...androidChannel,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: nudgeAt,
        },
      });
    }
  } catch {
    // Local reminders must never break the app.
  }
}
