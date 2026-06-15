import { format, isToday, isYesterday } from 'date-fns';

import type { Message } from '@/types/database';

export type ChatListItem =
  | { type: 'date'; id: string; label: string }
  | { type: 'unread'; id: string; count: number }
  | { type: 'message'; id: string; message: Message };

function formatDateLabel(iso: string) {
  const date = new Date(iso);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
}

export function buildChatListItems(
  messages: Message[],
  userId: string,
  unreadMessageIds?: Set<string>,
): ChatListItem[] {
  const items: ChatListItem[] = [];
  let lastDateKey = '';
  let unreadDividerInserted = false;

  const unreadPartnerMessages = unreadMessageIds
    ? messages.filter((m) => unreadMessageIds.has(m.id))
    : messages.filter((m) => m.sender_id !== userId && !m.read_at);

  for (const message of messages) {
    const dateKey = format(new Date(message.created_at), 'yyyy-MM-dd');
    if (dateKey !== lastDateKey) {
      items.push({ type: 'date', id: `date-${dateKey}`, label: formatDateLabel(message.created_at) });
      lastDateKey = dateKey;
    }

    const isUnread = unreadMessageIds
      ? unreadMessageIds.has(message.id)
      : message.sender_id !== userId && !message.read_at;

    if (!unreadDividerInserted && unreadPartnerMessages.length > 0 && isUnread) {
      items.push({
        type: 'unread',
        id: 'unread-divider',
        count: unreadPartnerMessages.length,
      });
      unreadDividerInserted = true;
    }

    items.push({ type: 'message', id: message.id, message });
  }

  return items;
}
