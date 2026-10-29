import { describe, expect, it } from 'vitest';

import { yearlySavingPercent } from '@/lib/plan-saving';

describe('yearlySavingPercent', () => {
  it('compares yearly with the full weekly price all year', () => {
    expect(yearlySavingPercent(69.99, 4.99)).toBe(73);
  });

  it('works in any store currency', () => {
    expect(yearlySavingPercent(299.99, 19.99)).toBe(71);
  });

  it('says nothing when there is no saving or a price is missing', () => {
    expect(yearlySavingPercent(300, 4.99)).toBeNull();
    expect(yearlySavingPercent(69.99, 0)).toBeNull();
  });
});
