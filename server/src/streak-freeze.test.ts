import { describe, expect, it } from 'vitest';

import { daysToFreeze } from './streak-freeze';

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
