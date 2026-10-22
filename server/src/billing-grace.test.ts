import { describe, expect, it } from 'vitest';

import { BILLING_GRACE_DAYS, graceUntil, plusStateOf } from './billing';

describe('billing grace period', () => {
  const now = Date.parse('2026-10-20T12:00:00Z');
  const day = 86_400_000;

  it('keeps Plus for the grace days past the end of the paid period', () => {
    const until = graceUntil(now - day, now);
    expect(Date.parse(until)).toBe(now + BILLING_GRACE_DAYS * day);
  });

  it('counts from the period end when that is still ahead', () => {
    expect(Date.parse(graceUntil(now + 2 * day, now))).toBe(now + 2 * day + BILLING_GRACE_DAYS * day);
  });

  it('a space in grace is still Plus', () => {
    const rel = {
      subscription_tier: 'plus',
      subscription_owner_id: 'u1',
      subscription_expires_at: graceUntil(Date.now() - day),
      subscription_period: 'grace',
    };
    expect(plusStateOf(rel as never).plus).toBe(true);
  });
});
