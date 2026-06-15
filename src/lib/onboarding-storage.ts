import AsyncStorage from '@react-native-async-storage/async-storage';

const AVATAR_PROMPT_KEY = 'moments_avatar_prompt_done';

export async function markAvatarPromptDone(userId: string) {
  await AsyncStorage.setItem(AVATAR_PROMPT_KEY, userId);
}

export async function isAvatarPromptDone(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(AVATAR_PROMPT_KEY);
  return value === userId;
}
