import { useRouter, type Href } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { useNotifications, useRealtimeSubscription } from '@/hooks/queries';
import { isInboxNotification } from '@/lib/notification-display';
import { openFromNotification } from '@/lib/notification-navigation';
import {
  configureNotificationPresentation,
  dispatchPendingPushNotifications,
  presentLocalNotification,
  registerForPushNotifications,
  subscribeToAppStatePushDispatch,
  subscribeToNotificationResponses,
} from '@/lib/push-notifications';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { Notification } from '@/types/database';

function isOwnUnreadNotification(row: Notification, userId: string | undefined): boolean {
  return !!userId && row.user_id === userId && !row.read;
}

/** Registers push tokens, realtime notification sync, and background local alerts. */
export function NotificationSync() {
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const { data: notifications } = useNotifications();
  const router = useRouter();
  const seenIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);

  useRealtimeSubscription('notifications');

  useEffect(() => {
    if (Platform.OS === 'web') return;
    configureNotificationPresentation();
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !user?.id) return;

    void registerForPushNotifications();
    void dispatchPendingPushNotifications();

    return subscribeToAppStatePushDispatch(() => {
      void dispatchPendingPushNotifications();
    });
  }, [user?.id]);

  useEffect(() => {
    if (!relationship?.id) return;
    void dispatchPendingPushNotifications();
  }, [relationship?.id]);

  useEffect(() => {
    if (!user?.id || !notifications?.length) return;

    if (!bootstrappedRef.current) {
      notifications.forEach((n) => seenIdsRef.current.add(n.id));
      bootstrappedRef.current = true;
      return;
    }

    for (const notification of notifications) {
      if (seenIdsRef.current.has(notification.id)) continue;
      seenIdsRef.current.add(notification.id);

      if (!isOwnUnreadNotification(notification, user.id)) continue;
      if (!isInboxNotification(notification)) continue;

      void presentLocalNotification(notification);
    }
  }, [notifications, user?.id]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const unsubscribe = subscribeToNotificationResponses((target) => {
      void openFromNotification(target, router);
    });

    return () => {
      unsubscribe?.();
    };
  }, [router]);

  return null;
}

/** @deprecated Prefer openFromNotification — kept for type-only call sites. */
export function openFromNotificationType(
  type: string | undefined,
  router: { push: (href: Href) => void },
) {
  void openFromNotification({ type }, router);
}
