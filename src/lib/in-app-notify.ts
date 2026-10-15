import type { IconName } from '@/components/ui/Icon';
import { getFirstName } from '@/lib/avatar-initial';
import { parseDbTimestampMs } from '@/lib/db-time';
import { PACKS } from '@/lib/handpicked';
import { getMessagePreviewText } from '@/lib/message-preview';
import { formatNotificationContent, NOTIFICATION_TYPE_ICON, NOTIFICATION_TYPE_LABEL } from '@/lib/notification-display';
import type { NotificationNavTarget } from '@/lib/notification-navigation';
import { useRelationshipStore } from '@/stores';
import { useGameRoomStore } from '@/stores/game-room-store';
import type { Message, Notification } from '@/types/database';

/** One Dynamic Island pop. `target` deep links on tap; `hideOn` skips it when you're already on that screen. */
export type IslandEvent = {
  id?: string;
  title: string;
  message?: string;
  icon?: IconName;
  avatar?: string | null;
  avatarName?: string | null;
  duration?: number;
  target?: NotificationNavTarget;
  hideOn?: (pathname: string) => boolean;
};

type Listener = (event: IslandEvent) => void;
const listeners = new Set<Listener>();

export function subscribeIsland(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Pop the island. Safe to call from anywhere; does nothing until the host is mounted. */
export function notifyIsland(event: IslandEvent): void {
  listeners.forEach((l) => l(event));
}

/**
 * The island shows an icon for each kind of notification, so the emoji our
 * notification text carries ("sent you a moment 📸") are dropped there.
 * Chat previews keep theirs: that's what your partner actually typed.
 */
export function stripEmoji(text: string | undefined): string | undefined {
  if (!text) return text;
  return text
    .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Rows older than this are backlog (e.g. a refetch after reconnecting), not live events. */
const FRESH_MS = 2 * 60 * 1000;

const PARTNER_TYPES = new Set([
  'moment',
  'mood',
  'mood_update',
  'challenge',
  'game_invite',
  'game_turn',
  'activity',
  'achievement',
  'calendar',
  'plus_unlocked',
  'plus_suggest',
]);

function partnerFace() {
  const partner = useRelationshipStore.getState().partner;
  return { avatar: partner?.avatar_url ?? null, avatarName: partner?.name ?? 'Partner' };
}

function isPackId(id: string | null | undefined): id is string {
  return !!id && PACKS.some((p) => p.id === id);
}

export function islandFromNotification(n: Notification, now = Date.now()): IslandEvent | null {
  const created = parseDbTimestampMs(n.created_at);
  if (created && now - created > FRESH_MS) return null;

  const face = PARTNER_TYPES.has(n.type) ? partnerFace() : {};
  const related = n.related_id ?? null;

  let hideOn: IslandEvent['hideOn'];
  if (n.type === 'game_turn' && related) hideOn = (p) => p === `/play/session/${related}`;
  if (n.type === 'activity' && isPackId(related)) hideOn = (p) => p === `/play/pack/${related}`;
  // The live invite sheet (or the room itself) already covers it.
  if (n.type === 'game_invite') hideOn = () => !!useGameRoomStore.getState().invite || useGameRoomStore.getState().open;
  if (n.type === 'calendar') hideOn = (p) => p.startsWith('/calendar');
  // Shown from the shared progress itself (AchievementRelay / trophy card), so never twice.
  if (n.type === 'achievement') hideOn = () => true;

  return {
    id: n.id,
    title: NOTIFICATION_TYPE_LABEL[n.type] ?? 'Moments',
    message: stripEmoji(formatNotificationContent(n.content)),
    icon: NOTIFICATION_TYPE_ICON[n.type] ?? 'bell',
    ...face,
    target: { type: n.type, relatedId: related, mediaUrl: n.media_url },
    hideOn,
  };
}

export function islandFromMessage(m: Partial<Message>): IslandEvent {
  const partner = useRelationshipStore.getState().partner;
  const preview = getMessagePreviewText({
    content: m.content ?? null,
    media_type: m.media_type ?? null,
    deleted_for_all: !!m.deleted_for_all,
  });
  return {
    id: m.id ? `msg:${m.id}` : undefined,
    title: getFirstName(partner?.name) ?? 'New message',
    message: preview || 'Sent you a message',
    icon: 'chat',
    avatar: partner?.avatar_url ?? null,
    avatarName: partner?.name ?? 'Partner',
    target: { type: 'message' },
    hideOn: (p) => p === '/chat',
  };
}
