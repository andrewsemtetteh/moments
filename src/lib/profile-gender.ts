import type { ProfileGender, UserProfile } from '@/types/database';

/** The genders you can pick (optional everywhere: you can also leave it unset). */
export const PROFILE_GENDER_OPTIONS: { value: ProfileGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

/** Answers from before the list was trimmed: still shown as they were picked. */
const EARLIER_LABELS: Partial<Record<ProfileGender, string>> = {
  genderqueer: 'Genderqueer',
  genderfluid: 'Genderfluid',
  agender: 'Agender',
};

/** Your gender: the newer column first, then the old one (older accounts). */
export function profileGender(user: Pick<UserProfile, 'gender' | 'gender_identity'> | null | undefined): ProfileGender | null {
  return user?.gender_identity ?? user?.gender ?? null;
}

export function profileGenderLabel(gender: ProfileGender | null | undefined): string {
  if (!gender) return 'Not set';
  return PROFILE_GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? EARLIER_LABELS[gender] ?? 'Not set';
}
