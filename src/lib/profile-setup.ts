import type { UserProfile } from '@/types/database';

/** True when the stored name is a signup/OAuth fallback, not user-chosen. */
export function isPlaceholderProfileName(
  name: string | null | undefined,
  email: string,
): boolean {
  const trimmed = name?.trim();
  if (!trimmed || trimmed === 'User') return true;

  const emailLocal = email.split('@')[0]?.trim().toLowerCase();
  if (emailLocal && trimmed.toLowerCase() === emailLocal) return true;

  return false;
}

export function needsProfileName(user: UserProfile): boolean {
  return isPlaceholderProfileName(user.name, user.email);
}

export function needsProfilePhoto(user: UserProfile, avatarPromptDone: boolean): boolean {
  if (!user.avatar_url && !avatarPromptDone) return true;
  return false;
}

export function needsProfileGender(user: UserProfile): boolean {
  return !user.gender;
}

export function needsProfileSetup(user: UserProfile, avatarPromptDone: boolean): boolean {
  if (needsProfileName(user)) return true;
  if (needsProfilePhoto(user, avatarPromptDone)) return true;
  if (needsProfileGender(user)) return true;
  return false;
}

export function profileSetupEntryRoute(user: UserProfile, avatarPromptDone: boolean): string {
  if (needsProfileName(user)) return '/(onboarding)/profile-name';
  if (needsProfilePhoto(user, avatarPromptDone)) return '/(onboarding)/profile-setup';
  if (needsProfileGender(user)) return '/(onboarding)/profile-gender';
  return '/(onboarding)/anniversary-setup';
}

export function defaultSignupName(email: string): string {
  return email.split('@')[0]?.trim() || 'User';
}
