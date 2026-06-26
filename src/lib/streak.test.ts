import { describe, expect, it } from 'vitest';

import {
  STREAK_RESTORE_WINDOW_MS,
  getStreakEndVariant,
  inferRestorableLostAt,
  isStreakRestoreAvailable,
  isStreakRestoreWindowOpen,
  withEffectiveStreakRestore,
} from '@/lib/streak';
import type { StreakStatus } from '@/types/database';

function baseStatus(overrides: Partial<StreakStatus> = {}): StreakStatus {
  return {
    relationship_id: 'rel-1',
    current_streak: 0,
    longest_streak: 12,
    last_active_date: '2026-06-20',
    at_risk: false,
    both_active_today: false,
    user_active_today: false,
    partner_active_today: false,
    can_restore_streak: true,
    restorable_streak: 12,
    restorable_lost_at: '2026-06-25T10:00:00.000Z',
    ...overrides,
  };
}

describe('inferRestorableLostAt', () => {
  it('returns the first lost day from last active date', () => {
    expect(inferRestorableLostAt('2026-06-20', new Date('2026-06-25T12:00:00'))).toBe('2026-06-22');
  });
});

describe('isStreakRestoreWindowOpen', () => {
  it('is open within 24 hours of loss', () => {
    const lostAt = '2026-06-25T10:00:00.000Z';
    expect(isStreakRestoreWindowOpen(lostAt, null, new Date('2026-06-26T09:59:59.000Z'))).toBe(true);
  });

  it('is closed after 24 hours', () => {
    const lostAt = '2026-06-25T10:00:00.000Z';
    expect(isStreakRestoreWindowOpen(lostAt, null, new Date('2026-06-26T10:00:01.000Z'))).toBe(false);
  });

  it('is closed after multiple inactive days', () => {
    expect(
      isStreakRestoreWindowOpen('2026-06-22', '2026-06-20', new Date('2026-06-25T09:00:00')),
    ).toBe(false);
  });

  it('infers expiry when restorable_lost_at is missing', () => {
    expect(
      isStreakRestoreWindowOpen(null, '2026-06-20', new Date('2026-06-25T09:00:00')),
    ).toBe(false);
  });
});

describe('isStreakRestoreAvailable', () => {
  it('returns false after 24 hours', () => {
    const status = baseStatus();
    expect(
      isStreakRestoreAvailable(status, new Date('2026-06-26T10:00:01.000Z')),
    ).toBe(false);
  });

  it('returns true inside the 24-hour window', () => {
    const status = baseStatus();
    expect(
      isStreakRestoreAvailable(status, new Date('2026-06-25T20:00:00.000Z')),
    ).toBe(true);
  });
});

describe('withEffectiveStreakRestore', () => {
  it('clears can_restore_streak when the window expired', () => {
    const status = baseStatus();
    const effective = withEffectiveStreakRestore(status, new Date('2026-06-26T11:00:00.000Z'));
    expect(effective.can_restore_streak).toBe(false);
  });
});

describe('getStreakEndVariant', () => {
  it('hides restore after 24 hours', () => {
    const status = baseStatus();
    expect(getStreakEndVariant(status, new Date('2026-06-26T11:00:00.000Z'))).toBeNull();
  });
});

describe('STREAK_RESTORE_WINDOW_MS', () => {
  it('is 24 hours', () => {
    expect(STREAK_RESTORE_WINDOW_MS).toBe(86_400_000);
  });
});
