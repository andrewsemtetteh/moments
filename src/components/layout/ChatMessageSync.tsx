import { useInfiniteMessages, useRealtimeSubscription } from '@/hooks/queries';

/** Warms the message cache app-wide so chat opens instantly with stale-while-revalidate. */
export function ChatMessageSync() {
  useInfiniteMessages();
  useRealtimeSubscription('messages');
  return null;
}
