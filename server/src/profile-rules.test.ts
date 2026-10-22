import { describe, expect, it } from 'vitest';

import { profileUpdateError } from './profile-rules';

describe('profile checks (PATCH /me and the Settings table route)', () => {
  const now = new Date('2026-10-19T12:00:00Z');

  it('accepts the gender options, older answers, and clearing it', () => {
    for (const g of ['male', 'female', 'non_binary', 'other', 'prefer_not_to_say', 'genderqueer']) {
      expect(profileUpdateError({ gender_identity: g }, now)).toBeNull();
    }
    expect(profileUpdateError({ gender_identity: null }, now)).toBeNull();
  });

  it('rejects anything not on the list', () => {
    expect(profileUpdateError({ gender_identity: 'robot' }, now)).toMatch(/listed options/);
  });

  it('accepts a birthday 16 or more years ago, and clearing it', () => {
    expect(profileUpdateError({ birthday: '2000-01-01' }, now)).toBeNull();
    expect(profileUpdateError({ birthday: '2010-10-19' }, now)).toBeNull(); // 16 today
    expect(profileUpdateError({ birthday: null }, now)).toBeNull();
  });

  it('rejects under 16', () => {
    expect(profileUpdateError({ birthday: '2010-10-21' }, now)).toMatch(/16 and over/);
    expect(profileUpdateError({ birthday: '2015-05-05' }, now)).toMatch(/16 and over/);
  });

  it('rejects dates that don’t exist, the future, and nonsense', () => {
    expect(profileUpdateError({ birthday: '2001-02-30' }, now)).toMatch(/look right/);
    expect(profileUpdateError({ birthday: '2030-01-01' }, now)).toMatch(/look right/);
    expect(profileUpdateError({ birthday: '1850-01-01' }, now)).toMatch(/look right/);
    expect(profileUpdateError({ birthday: 'soon' }, now)).toMatch(/look right/);
  });

  it('leaves other fields alone', () => {
    expect(profileUpdateError({ name: 'Ama', notification_prefs: {} }, now)).toBeNull();
  });
});
