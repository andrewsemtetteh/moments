import type { Href } from 'expo-router';

import { openActivities, openCalendar, openChat } from '@/lib/router';
import * as api from '@/services/api';
import { useUIStore } from '@/stores';
import type { Notification } from '@/types/database';

export type NotificationNavTarget = {
  type?: string | null;
  relatedId?: string | null;
  mediaUrl?: string | null;
};

type RouterLike = { push: (href: Href) => void };

function goHome(router: RouterLike) {
  router.push('/(tabs)/home');
}

function afterNavigate(action: () => void) {
  // Let the tab transition settle before opening overlays.
  setTimeout(action, 80);
}

async function openMomentFromNotification(relatedId?: string | null) {
  const ui = useUIStore.getState();
  if (relatedId) {
    try {
      const moment = await api.fetchMomentById(relatedId);
      if (moment) {
        ui.openMomentViewer([moment], 0, {
          playback: 'focus',
          homeWindowOnly: false,
          sectionLabel: 'From notification',
        });
        return;
      }
    } catch {
      // Fall through
    }
  }
  ui.setShowMomentHistory(true);
}

/**
 * Deep-link from an in-app or push notification to the relevant screen / overlay.
 */
export async function openFromNotification(
  target: NotificationNavTarget,
  router: RouterLike,
): Promise<void> {
  const type = target.type ?? undefined;

  switch (type) {
    case 'message':
    case 'message_new':
      openChat();
      return;

    case 'moment':
      goHome(router);
      afterNavigate(() => {
        void openMomentFromNotification(target.relatedId);
      });
      return;

    case 'mood':
    case 'mood_update':
      goHome(router);
      afterNavigate(() => {
        useUIStore.getState().setShowMoodHistory(true);
      });
      return;

    case 'streak':
      goHome(router);
      return;

    case 'challenge':
      goHome(router);
      return;

    case 'calendar':
      openCalendar();
      return;

    case 'activity':
      openActivities();
      return;

    case 'watch_party':
    case 'watch_party_nudge':
      goHome(router);
      afterNavigate(() => {
        useUIStore.getState().openWatchTogether('hub');
      });
      return;

    case 'watch_party_scheduled':
      goHome(router);
      afterNavigate(() => {
        useUIStore.getState().openWatchTogether('schedule');
      });
      return;

    default:
      router.push('/(tabs)/notifications');
  }
}

export function notificationNavTargetFromRow(item: Notification): NotificationNavTarget {
  return {
    type: item.type,
    relatedId: item.related_id,
    mediaUrl: item.media_url,
  };
}
