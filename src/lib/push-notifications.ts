import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { loadExpoNotifications } from '@/lib/expo-notifications-safe';
import * as api from '@/services/api';
import type { Notification } from '@/types/database';

function loadNotifications() {
  return loadExpoNotifications();
}

function getExpoProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

export async function registerForPushNotifications(): Promise<string | null> {
  const Notifications = loadNotifications();
  if (!Notifications || !Device.isDevice) return null;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Moments',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    if (!existing.granted) return null;

    return await registerPushTokenWithNotifications(Notifications);
  } catch {
    return null;
  }
}

/** Onboarding soft prompt — asks for permission, then registers the token. */
export async function requestPushNotificationPermission(): Promise<boolean> {
  const Notifications = loadNotifications();
  if (!Notifications || !Device.isDevice) return false;

  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Moments',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const existing = await Notifications.getPermissionsAsync();
    let granted = existing.granted;
    if (!granted) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) return false;

    const token = await registerPushTokenWithNotifications(Notifications);
    return !!token;
  } catch {
    return false;
  }
}

async function registerPushTokenWithNotifications(
  Notifications: NonNullable<ReturnType<typeof loadNotifications>>,
): Promise<string | null> {
  const projectId = getExpoProjectId();
  const tokenResult = projectId
    ? await Notifications.getExpoPushTokenAsync({ projectId })
    : await Notifications.getExpoPushTokenAsync();

  const token = tokenResult.data;
  if (!token) return null;

  await api.registerPushToken(token);
  return token;
}

export async function clearPushTokenRegistration(): Promise<void> {
  try {
    await api.registerPushToken(null);
  } catch {
    // ignore
  }
}

/** Ask the server to deliver any pending Expo pushes for this couple. */
export async function dispatchPendingPushNotifications(limit = 10): Promise<void> {
  try {
    await api.dispatchPendingPushNotifications(limit);
  } catch {
    // Push delivery should never block UX.
  }
}

export function configureNotificationPresentation(): void {
  try {
    const Notifications = loadNotifications();
    if (!Notifications) return;

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch {
    // Expo Go and other unsupported runtimes — in-app notifications still work.
  }
}

export function subscribeToNotificationResponses(
  onResponse: (target: {
    type?: string;
    relatedId?: string | null;
    mediaUrl?: string | null;
  }) => void,
): (() => void) | null {
  try {
    const Notifications = loadNotifications();
    if (!Notifications) return null;

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as {
        type?: string;
        related_id?: string | null;
        media_url?: string | null;
      };
      onResponse({
        type: data?.type,
        relatedId: data?.related_id,
        mediaUrl: data?.media_url,
      });
    });

    return () => sub.remove();
  } catch {
    return null;
  }
}

export async function presentLocalNotification(notification: Notification): Promise<void> {
  const Notifications = loadNotifications();
  if (!Notifications) return;
  if (AppState.currentState === 'active') return;

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: titleForType(notification.type),
        body: notification.content,
        data: {
          notification_id: notification.id,
          type: notification.type,
          relationship_id: notification.relationship_id,
          related_id: notification.related_id ?? null,
          media_url: notification.media_url ?? null,
        },
      },
      trigger: null,
    });
  } catch {
    // ignore
  }
}

export function titleForType(type: string): string {
  switch (type) {
    case 'message':
      return 'New message';
    case 'moment':
      return 'New moment';
    case 'mood':
    case 'mood_update':
      return 'Mood update';
    case 'streak':
      return 'Streak update';
    case 'watch_party':
    case 'watch_party_nudge':
      return 'Watch Together';
    case 'watch_party_scheduled':
      return 'Movie night scheduled';
    default:
      return 'Moments';
  }
}

export function subscribeToAppStatePushDispatch(
  onForeground: () => void,
): () => void {
  const handler = (state: AppStateStatus) => {
    if (state === 'active') onForeground();
  };
  const sub = AppState.addEventListener('change', handler);
  return () => sub.remove();
}
