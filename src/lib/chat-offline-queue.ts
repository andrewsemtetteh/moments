import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ChatOfflinePayload {
  content: string;
  momentId?: string;
  mediaLocalUri?: string;
  mediaType?: string;
  replyToId?: string;
}

export interface ChatOfflineItem {
  id: string;
  type: 'message';
  payload: ChatOfflinePayload;
  createdAt: string;
}

const KEY_PREFIX = 'chat-offline-queue:';

function storageKey(relationshipId: string) {
  return `${KEY_PREFIX}${relationshipId}`;
}

export async function loadChatOfflineQueue(relationshipId: string): Promise<ChatOfflineItem[]> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(relationshipId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatOfflineItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveChatOfflineQueue(relationshipId: string, items: ChatOfflineItem[]): Promise<void> {
  await AsyncStorage.setItem(storageKey(relationshipId), JSON.stringify(items));
}

export async function clearChatOfflineQueue(relationshipId: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(relationshipId));
}
