import AsyncStorage from '@react-native-async-storage/async-storage';

const AVATAR_PROMPT_KEY = 'moments_avatar_prompt_done';
const RELATIONSHIP_ONBOARDING_KEY = 'moments_relationship_onboarding_done';
const NOTIFICATION_PROMPT_KEY = 'moments_notification_prompt_done';

export async function markAvatarPromptDone(userId: string) {
  await AsyncStorage.setItem(AVATAR_PROMPT_KEY, userId);
}

export async function isAvatarPromptDone(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(AVATAR_PROMPT_KEY);
  return value === userId;
}

export async function markRelationshipOnboardingDone(userId: string) {
  await AsyncStorage.setItem(RELATIONSHIP_ONBOARDING_KEY, userId);
}

export async function isRelationshipOnboardingDone(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(RELATIONSHIP_ONBOARDING_KEY);
  return value === userId;
}

export async function markNotificationPromptDone(userId: string) {
  await AsyncStorage.setItem(NOTIFICATION_PROMPT_KEY, userId);
}

export async function isNotificationPromptDone(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(NOTIFICATION_PROMPT_KEY);
  return value === userId;
}

const ONBOARDING_PAYWALL_KEY = 'moments_onboarding_paywall_done';

export async function markOnboardingPaywallDone(userId: string) {
  await AsyncStorage.setItem(ONBOARDING_PAYWALL_KEY, userId);
}

export async function isOnboardingPaywallDone(userId: string): Promise<boolean> {
  const value = await AsyncStorage.getItem(ONBOARDING_PAYWALL_KEY);
  return value === userId;
}
