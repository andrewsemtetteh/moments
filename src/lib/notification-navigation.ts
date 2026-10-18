import type { Href } from 'expo-router';

import { PACKS } from '@/lib/handpicked';
import { BADGES } from '@/lib/play-progress';
import { openActivities, openCalendar, openChat } from '@/lib/router';
import * as api from '@/services/api';
import { getFirstName } from '@/lib/avatar-initial';
import { getEffectiveTier } from '@/lib/subscription';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import { useGameRoomStore } from '@/stores/game-room-store';
import type { Notification } from '@/types/database';

export type NotificationNavTarget = {
  type?: string | null;
  relatedId?: string | null;
  mediaUrl?: string | null;
};

// `navigate`, not `push`: the tabs are already on the root stack underneath
// (and Notifications/Chat/Plan are pushed above them), so pushing a tab route
// would stack a second copy of the whole tab navigator instead of popping
// back down to the existing one.
type RouterLike = { navigate: (href: Href) => void };

function goHome(router: RouterLike) {
  router.navigate('/(tabs)/home');
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
  ui.setMomentHistoryReturnToCamera(false);
  ui.setShowMomentHistory(true);
}

/**
 * A live invite: bring back the Join / Join muted / Not now sheet for the room that's still open,
 * rather than joining straight in (that would turn on your mic without you choosing to).
 * If the room has ended, say so and land on Play.
 */
function reopenLiveInvite() {
  const room = useGameRoomStore.getState();
  if (room.open) return;
  const state = room.state;
  const myId = useAuthStore.getState().user?.id;
  if (state && state.phase !== 'finished' && state.hostId !== myId) {
    const fromName = state.players.find((p) => p.id === state.hostId)?.name ?? 'Your partner';
    useGameRoomStore.setState({ invite: { roomId: state.id, game: state.game, fromName } });
    return;
  }
  openActivities();
  void import('@/lib/in-app-notify').then(({ notifyIsland }) =>
    notifyIsland({
      title: 'Session ended',
      message: 'That live game has finished. Start a new one anytime.',
      icon: 'gamepad',
    }),
  );
}

/**
 * Deep-link from an in-app or push notification to the relevant screen / overlay.
 */
export async function openFromNotification(target: NotificationNavTarget, router: RouterLike): Promise<void> {
  const type = target.type ?? undefined;

  switch (type) {
    case 'message':
    case 'message_new':
      openChat();
      return;

    case 'moment':
      // The moment opens right over where you are (Moments is a modal over the whole app),
      // so closing it brings you back here, e.g. to the notifications list. No stop at Home.
      void openMomentFromNotification(target.relatedId);
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

    // Local reminders (see relationship-reminders): anniversary and milestones
    // land on You (where days together can be shared); Wrapped opens itself.
    case 'anniversary':
    case 'milestone':
      router.navigate('/(tabs)/profile');
      return;

    // Your partner's birthday: Home, where its card is.
    case 'birthday':
      goHome(router);
      return;

    case 'wrapped':
      router.navigate('/(tabs)/profile');
      afterNavigate(() => {
        useUIStore.getState().setShowWrapped(true);
      });
      return;

    case 'activity':
      if (target.relatedId && PACKS.some((p) => p.id === target.relatedId)) {
        router.navigate({ pathname: '/play/pack/[id]', params: { id: target.relatedId } });
      } else {
        openActivities();
      }
      return;

    // Opening the app is enough: a call that's still ringing shows its own screen.
    case 'call':
      return;

    // A trophy your partner unlocked opens that trophy; a quest (no id) opens Play.
    case 'achievement':
      if (target.relatedId && BADGES.some((b) => b.id === target.relatedId)) {
        const id = target.relatedId;
        afterNavigate(() => useUIStore.getState().openTrophy(id));
      } else {
        openActivities();
      }
      return;

    case 'game_invite':
      reopenLiveInvite();
      return;

    case 'game_turn':
      if (target.relatedId) {
        router.navigate({ pathname: '/play/session/[id]', params: { id: target.relatedId } });
      } else {
        openActivities();
      }
      return;

    // "Sam unlocked Plus for you both": it's already on, so just land Home.
    case 'plus_unlocked':
      goHome(router);
      return;

    // "Sam wants to try Plus with you": the paywall, unless one of you already has it.
    case 'plus_suggest':
      goHome(router);
      afterNavigate(() => {
        const { relationship } = useRelationshipStore.getState();
        if (getEffectiveTier(useAuthStore.getState().user, relationship) === 'plus') return;
        const them = getFirstName(useRelationshipStore.getState().partner?.name) ?? 'Your person';
        useUIStore.getState().openPaywall(undefined, { headline: `${them} wants Plus with you` });
      });
      return;

    default:
      router.navigate('/notifications');
  }
}

export function notificationNavTargetFromRow(item: Notification): NotificationNavTarget {
  return {
    type: item.type,
    relatedId: item.related_id,
    mediaUrl: item.media_url,
  };
}
