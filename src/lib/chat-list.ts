import { format, isSameWeek, isThisWeek, isToday, isYesterday, subWeeks } from 'date-fns';

import type { Message } from '@/types/database';

export type ChatListItem =
  | { type: 'date'; id: string; label: string }
  | { type: 'unread'; id: string; count: number }
  | { type: 'message'; id: string; message: Message };

const WEEK_OPTS = { weekStartsOn: 1 as const };

/** Date pill between message groups in chat. */
export function formatChatDateLabel(iso: string, now = Date.now()): string {
  const date = new Date(iso);
  const nowDate = new Date(now);

  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';

  if (isThisWeek(date, WEEK_OPTS)) {
    return format(date, 'EEEE');
  }

  if (isSameWeek(date, subWeeks(nowDate, 1), WEEK_OPTS)) {
    return `Last ${format(date, 'EEEE')}`;
  }

  if (date.getFullYear() === nowDate.getFullYear()) {
    return format(date, 'MMMM d');
  }

  return format(date, 'MMMM d, yyyy');
}

function formatDateLabel(iso: string) {
  return formatChatDateLabel(iso);
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
