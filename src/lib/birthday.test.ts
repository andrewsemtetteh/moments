import { describe, expect, it } from 'vitest';

import { ageOn, daysUntilBirthday, isOldEnough, latestBirthYear, nextBirthday, turningAge } from '@/lib/birthday';

describe('birthdays', () => {
  const now = new Date('2026-10-18T15:00:00');

  it('counts down to this year’s birthday, or next year’s once it has passed', () => {
    expect(daysUntilBirthday('1998-10-24', now)).toBe(6);
    expect(daysUntilBirthday('1998-10-18', now)).toBe(0);
    expect(nextBirthday('1998-03-02', now)?.getFullYear()).toBe(2027);
  });

  it('knows the age they turn next', () => {
    expect(turningAge('1998-10-24', now)).toBe(28);
    expect(turningAge('1998-03-02', now)).toBe(29);
  });

  it('celebrates 29 February on 28 February in other years', () => {
    const next = nextBirthday('2000-02-29', now);
    expect(next?.getMonth()).toBe(1);
    expect(next?.getDate()).toBe(28);
  });

  it('ignores missing or malformed birthdays', () => {
    expect(daysUntilBirthday(null, now)).toBeNull();
    expect(daysUntilBirthday('24/10/1998', now)).toBeNull();
  });
});

describe('age (16+)', () => {
  const now = new Date('2026-10-19T09:00:00');

  it('works out age, before and after this year’s birthday', () => {
    expect(ageOn('2000-10-19', now)).toBe(26);
    expect(ageOn('2000-10-20', now)).toBe(25);
    expect(ageOn('not a date', now)).toBeNull();
  });

  it('is old enough from the 16th birthday', () => {
    expect(isOldEnough('2010-10-19', now)).toBe(true);
    expect(isOldEnough('2010-10-20', now)).toBe(false);
    expect(isOldEnough(null, now)).toBe(false);
  });

  it('stops the birthday wheels at the youngest allowed year', () => {
    expect(latestBirthYear(now)).toBe(2010);
  });
});
