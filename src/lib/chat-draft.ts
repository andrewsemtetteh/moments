import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Message } from '@/types/database';

/**
 * Unsent chat text survives leaving Chat (and restarting the app), like
 * WhatsApp/iMessage drafts.
 * - Memory cache: restores instantly on the next open, no flash of an empty box.
 * - AsyncStorage: survives the app being closed (text only).
 * The message being replied to is kept in memory only — after a restart the
 * text comes back but the reply chip doesn't.
 */
type Draft = { text: string; replyTo: Message | null };

const cache = new Map<string, Draft>();
const storageKey = (relationshipId: string) => `chat-draft:${relationshipId}`;

export function getCachedChatDraft(relationshipId: string | undefined): Draft | null {
  if (!relationshipId) return null;
  return cache.get(relationshipId) ?? null;
}

export async function loadStoredChatDraft(relationshipId: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(storageKey(relationshipId));
  } catch {
    return null;
  }
}

export function saveChatDraft(relationshipId: string, draft: Draft) {
  const hasContent = draft.text.trim().length > 0;
  if (hasContent || draft.replyTo) cache.set(relationshipId, draft);
  else cache.delete(relationshipId);

  const write = hasContent
    ? AsyncStorage.setItem(storageKey(relationshipId), draft.text)
    : AsyncStorage.removeItem(storageKey(relationshipId));
  void write.catch(() => undefined);
}
