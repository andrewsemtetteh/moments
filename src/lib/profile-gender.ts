import type { ProfileGender, UserProfile } from '@/types/database';

/** The genders you can pick. Optional everywhere: you can leave it unset. */
export const PROFILE_GENDER_OPTIONS: { value: ProfileGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Genderqueer or non-binary' },
  { value: 'other', label: 'Other' },
];

/** Your gender: the newer column first, then the old one (older accounts). */
export function profileGender(user: Pick<UserProfile, 'gender' | 'gender_identity'> | null | undefined): ProfileGender | null {
  return user?.gender_identity ?? user?.gender ?? null;
}

export function profileGenderLabel(gender: ProfileGender | null | undefined): string {
  if (!gender) return 'Not set';
  return PROFILE_GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? 'Not set';
}
