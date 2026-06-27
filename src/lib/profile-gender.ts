import type { ProfileGender } from '@/types/database';

export const PROFILE_GENDER_OPTIONS: { value: ProfileGender; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export function profileGenderLabel(gender: ProfileGender | null | undefined): string {
  if (!gender) return 'Not set';
  return PROFILE_GENDER_OPTIONS.find((option) => option.value === gender)?.label ?? 'Not set';
}
