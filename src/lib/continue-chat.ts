import type { Message } from '@/types/database';

/** Show the home Continue Chat card for this long after the last message. */
export const CONTINUE_CHAT_VISIBLE_DAYS = 14;

/** Compact relative time for the Continue Chat card. */
export function shortMessageAgo(iso: string, now = new Date()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.max(0, Math.floor((now.getTime() - then) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function continueChatPreview(
  message: Message,
  currentUserId: string,
): string {
  const fromYou = message.sender_id === currentUserId;
  const prefix = fromYou ? 'You: ' : '';

  if (message.media_type === 'image') return `${prefix}Sent a photo`;
  if (message.media_type === 'video') return `${prefix}Sent a video`;
  if (message.media_type === 'voice') return `${prefix}Sent a voice note`;
  if (message.moment_id) return `${prefix}Shared a moment`;

  const text = (message.content ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return fromYou ? 'You sent a message' : 'Sent you a message';
  return `${prefix}${text}`;
}

type ContinueChatTitleInput = {
  partnerFirst: string;
  fromPartner: boolean;
  unread: boolean;
  minutesAgo: number;
};

/**
 * Soft, relationship-forward titles — not productivity copy.
 */
export function continueChatTitle({
  partnerFirst,
  fromPartner,
  unread,
  minutesAgo,
}: ContinueChatTitleInput): string {
  if (unread && fromPartner) {
    if (minutesAgo <= 5) return `${partnerFirst} replied just now`;
    if (minutesAgo <= 60) return `${partnerFirst} replied ${minutesAgo}m ago`;
    return `${partnerFirst} sent you a message`;
  }

  if (fromPartner) {
    if (minutesAgo <= 180) return 'Still thinking about each other?';
    return 'Pick up where you left off';
  }

  if (minutesAgo <= 30) return 'One more message?';
  if (minutesAgo <= 24 * 60) return 'Your conversation is waiting';
  return 'Continue chatting';
}

/** Partner + recent thread, or any unread from them — hide empty / stale chats. */
export function shouldShowContinueChat(input: {
  hasPartner: boolean;
  latest: Message | null | undefined;
  unreadCount: number;
  currentUserId?: string | null;
  now?: Date;
}): boolean {
  const { hasPartner, latest, unreadCount, currentUserId, now = new Date() } = input;
  if (!hasPartner || !latest || !currentUserId) return false;

  const fromPartner = latest.sender_id !== currentUserId;
  const unreadFromPartner = unreadCount > 0 && fromPartner;
  if (unreadFromPartner) return true;

  const ageMs = now.getTime() - new Date(latest.created_at).getTime();
  if (Number.isNaN(ageMs) || ageMs < 0) return false;

  return ageMs <= CONTINUE_CHAT_VISIBLE_DAYS * 24 * 60 * 60 * 1000;
}
