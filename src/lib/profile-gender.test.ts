import { describe, expect, it } from 'vitest';

import { PROFILE_GENDER_OPTIONS, profileGender, profileGenderLabel } from '@/lib/profile-gender';

describe('gender options', () => {
  it('offers exactly the five options, in order', () => {
    expect(PROFILE_GENDER_OPTIONS.map((o) => o.label)).toEqual([
      'Male',
      'Female',
      'Non-binary',
      'Other',
      'Prefer not to say',
    ]);
  });

  it('still names answers from before the list was trimmed', () => {
    expect(profileGenderLabel('genderqueer')).toBe('Genderqueer');
    expect(profileGenderLabel(null)).toBe('Not set');
  });

  it('reads the newer column first, then the old one', () => {
    expect(profileGender({ gender: 'male', gender_identity: 'non_binary' })).toBe('non_binary');
    expect(profileGender({ gender: 'female', gender_identity: null })).toBe('female');
    expect(profileGender(null)).toBeNull();
  });
});
