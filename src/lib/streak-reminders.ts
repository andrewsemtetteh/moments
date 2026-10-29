import { Platform } from 'react-native';

import { localCalendarDate } from '@/lib/db-time';
import { loadExpoNotifications } from '@/lib/expo-notifications-safe';
import {
  needsStreakReminders,
  STREAK_NUDGE_HOURS_BEFORE_MIDNIGHT,
  streakReminderFireAt,
} from '@/lib/streak-reminder-timing';
import type { StreakStatus } from '@/types/database';

export {
  isStreakVisuallyAtRisk,
  msUntilLocalMidnight,
  needsStreakReminders,
  STREAK_NUDGE_HOURS_BEFORE_MIDNIGHT,
  STREAK_WARN_HOURS_BEFORE_MIDNIGHT,
  streakReminderFireAt,
} from '@/lib/streak-reminder-timing';

// Warn and end were scheduled by earlier versions: still cancelled, never scheduled now.
const WARN_ID_PREFIX = 'streak-warn-3h:';
const NUDGE_ID_PREFIX = 'streak-nudge-1h:';
const END_ID_PREFIX = 'streak-end:';

function loadNotifications() {
  return loadExpoNotifications();
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
          return (
            id.startsWith(WARN_ID_PREFIX) ||
            id.startsWith(NUDGE_ID_PREFIX) ||
            id.startsWith(END_ID_PREFIX)
          );
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
 * Schedules tonight's 1-hour "last chance" when your streak ends at midnight and you
 * haven't checked in. The 3-hour warning and "it ended / restore it" come from the server
 * (pushes that know about freezes and Plus), so they aren't doubled here. Cancels it once
 * you've checked in, and clears the older warn/end ones earlier versions scheduled.
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

    const nudgeAt = streakReminderFireAt(STREAK_NUDGE_HOURS_BEFORE_MIDNIGHT, now);
    if (!nudgeAt) return;

    await ensureStreakChannel(Notifications);

    const count = status.current_streak;
    const streakLabel = count === 1 ? '1 day streak' : `${count} day streak`;
    const freezes = status.streak_freezes ?? 0;
    await Notifications.scheduleNotificationAsync({
      identifier: nudgeIdentifier(localCalendarDate(now)),
      content: {
        title: 'Last chance',
        body: freezes
          ? `Your ${streakLabel} ends in 1 hour. Check in now, or a freeze will be used.`
          : `Your ${streakLabel} ends in 1 hour. Check in before midnight.`,
        data: { type: 'streak', kind: 'nudge' },
        ...(Platform.OS === 'android' ? { channelId: 'streaks' as const } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: nudgeAt,
      },
    });
  } catch {
    // Local reminders must never break the app.
  }
}
