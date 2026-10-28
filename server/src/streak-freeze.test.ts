import { describe, expect, it } from 'vitest';

import { daysToFreeze, localMidnightMs, streakLostDay } from './streak-freeze';

describe('streak freezes', () => {
  it('needs none when you checked in yesterday', () => {
    expect(daysToFreeze('2026-10-18', '2026-10-19', 0)).toEqual([]);
  });

  it('covers one missed day with one freeze', () => {
    expect(daysToFreeze('2026-10-17', '2026-10-19', 1)).toEqual(['2026-10-18']);
  });

  it('covers two missed days with two freezes', () => {
    expect(daysToFreeze('2026-10-16', '2026-10-19', 2)).toEqual(['2026-10-17', '2026-10-18']);
  });

  it('can’t save it when more days were missed than freezes held', () => {
    expect(daysToFreeze('2026-10-16', '2026-10-19', 1)).toBeNull();
    expect(daysToFreeze('2026-10-17', '2026-10-19', 0)).toBeNull();
    expect(daysToFreeze(null, '2026-10-19', 2)).toBeNull();
  });
});

describe('when a missed streak ended', () => {
  it('is the start of the day after the missed one', () => {
    expect(streakLostDay('2026-10-17', 0)).toBe('2026-10-19');
  });

  it('is pushed back by each freeze held', () => {
    expect(streakLostDay('2026-10-15', 1)).toBe('2026-10-18');
    expect(streakLostDay('2026-10-15', 2)).toBe('2026-10-19');
  });

  it('is that midnight where the person is', () => {
    expect(new Date(localMidnightMs('2026-10-19', null)).toISOString()).toBe('2026-10-19T00:00:00.000Z');
    expect(new Date(localMidnightMs('2026-10-19', 'America/New_York')).toISOString()).toBe('2026-10-19T04:00:00.000Z');
    expect(new Date(localMidnightMs('2026-10-19', 'Asia/Tokyo')).toISOString()).toBe('2026-10-18T15:00:00.000Z');
    expect(new Date(localMidnightMs('2026-11-02', 'America/New_York')).toISOString()).toBe('2026-11-02T05:00:00.000Z');
    expect(new Date(localMidnightMs('2026-10-19', 'Not/AZone')).toISOString()).toBe('2026-10-19T00:00:00.000Z');
  });
});
