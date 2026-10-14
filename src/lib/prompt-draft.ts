import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Your unsent answer to today's question, kept per question so leaving Home
 * (or closing the app) never loses it. Same approach as chat drafts.
 */
const cache = new Map<string, string>();
const storageKey = (challengeId: string) => `prompt-draft:${challengeId}`;

export function getCachedPromptDraft(challengeId: string): string {
  return cache.get(challengeId) ?? '';
}

export async function loadStoredPromptDraft(challengeId: string): Promise<string> {
  try {
    return (await AsyncStorage.getItem(storageKey(challengeId))) ?? '';
  } catch {
    return '';
  }
}

export function savePromptDraft(challengeId: string, text: string) {
  if (text.trim()) cache.set(challengeId, text);
  else cache.delete(challengeId);
  const write = text.trim()
    ? AsyncStorage.setItem(storageKey(challengeId), text)
    : AsyncStorage.removeItem(storageKey(challengeId));
  void write.catch(() => undefined);
}
