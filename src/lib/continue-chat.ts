import { getAttachmentPreviewText, parseAttachment, type ChatAttachment } from '@/lib/chat-attachments';
import { parseDbTimestampMs } from '@/lib/db-time';
import type { Message } from '@/types/database';

/** Show the home Continue Chat card for this long after the last message. */
export const CONTINUE_CHAT_VISIBLE_DAYS = 14;

export function messageTimestampMs(iso: string): number {
  return parseDbTimestampMs(iso);
}

/** Compact relative time for the Continue Chat card — always based on send time. */
export function shortMessageAgo(iso: string, now = new Date()): string {
  const then = messageTimestampMs(iso);
  if (Number.isNaN(then)) return '';
  const nowMs = now instanceof Date ? now.getTime() : now;
  // Ignore clock skew that would otherwise pin the label on "just now".
  const seconds = Math.max(0, Math.floor((nowMs - then) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/** The shared location/contact/file card riding on this message, if any — used to render a richer preview than plain text. */
export function continueChatAttachment(message: Message): ChatAttachment | null {
  if (message.media_type === 'image' || message.media_type === 'video' || message.media_type === 'voice') {
    return null;
  }
  if (message.moment_id) return null;
  return parseAttachment(message.content);
}

export function continueChatPreview(
  message: Message,
  currentUserId: string,
  partnerFirst?: string | null,
): string {
  const fromYou = message.sender_id === currentUserId;
  const who = fromYou ? 'You' : (partnerFirst?.trim() || 'Them');
  const prefix = `${who}: `;

  if (message.media_type === 'image') return `${prefix}Sent a photo`;
  if (message.media_type === 'video') return `${prefix}Sent a video`;
  if (message.media_type === 'voice') return `${prefix}Sent a voice note`;
  if (message.moment_id) return `${prefix}Shared a moment`;

  const attachment = continueChatAttachment(message);
  if (attachment) return `${prefix}${getAttachmentPreviewText(attachment)}`;

  const text = (message.content ?? '').trim().replace(/\s+/g, ' ');
  if (!text) return fromYou ? 'You sent a message' : `${who} sent you a message`;
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
 * Uses "sent" / "messaged" (not "replied") — the latest message may be a new thread, not a reply.
 * Time-ago lives on the right of the card, so titles stay free of "Xm ago".
 */
export function continueChatTitle({
  partnerFirst,
  fromPartner,
  unread,
  minutesAgo,
}: ContinueChatTitleInput): string {
  if (unread && fromPartner) {
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

  // Only while there's something new from them you haven't read; once it's read
  // (or the last message is yours) Home doesn't need a way back into Chat.
  const fromPartner = latest.sender_id !== currentUserId;
  return unreadCount > 0 && fromPartner && !Number.isNaN(now.getTime());
}
