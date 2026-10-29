import { describe, expect, it } from 'vitest';

import {
  isPartnerStreakEndingSoon,
  parseStreakStatus,
  STREAK_RESTORE_FREE_MS,
  STREAK_RESTORE_WINDOW_MS,
  isStreakRestoreFree,
  streakRestoreFreeMsLeft,
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
  it('is open within 5 days of loss', () => {
    const lostAt = '2026-06-25T10:00:00.000Z';
    expect(isStreakRestoreWindowOpen(lostAt, null, new Date('2026-06-30T09:59:59.000Z'))).toBe(true);
  });

  it('is closed after 5 days', () => {
    const lostAt = '2026-06-25T10:00:00.000Z';
    expect(isStreakRestoreWindowOpen(lostAt, null, new Date('2026-06-30T10:00:01.000Z'))).toBe(false);
  });

  it('infers the loss from the last check-in when the server gave no time', () => {
    // Last checked in on the 20th: lost from the start of the 22nd, restorable to the 27th.
    expect(isStreakRestoreWindowOpen(null, '2026-06-20', new Date('2026-06-25T09:00:00'))).toBe(true);
    expect(isStreakRestoreWindowOpen(null, '2026-06-20', new Date('2026-06-27T09:00:00'))).toBe(false);
  });
});

describe('isStreakRestoreAvailable', () => {
  it('returns false after 5 days', () => {
    const status = baseStatus();
    expect(isStreakRestoreAvailable(status, new Date('2026-06-30T10:00:01.000Z'))).toBe(false);
  });

  it('returns true inside the window', () => {
    const status = baseStatus();
    expect(isStreakRestoreAvailable(status, new Date('2026-06-27T20:00:00.000Z'))).toBe(true);
  });

  it('follows the server’s deadline when it gives one', () => {
    const status = baseStatus({ restore_until: '2026-06-26T00:00:00.000Z' });
    expect(isStreakRestoreAvailable(status, new Date('2026-06-26T00:00:01.000Z'))).toBe(false);
  });
});

describe('isStreakRestoreFree', () => {
  const free = baseStatus({ restore_free: true, restore_free_until: '2026-06-26T10:00:00.000Z' });

  it('is free on the day it was lost, with Plus', () => {
    expect(isStreakRestoreFree(free, new Date('2026-06-26T09:00:00.000Z'))).toBe(true);
    expect(streakRestoreFreeMsLeft(free, new Date('2026-06-26T09:00:00.000Z'))).toBe(3_600_000);
  });

  it('needs a paid restore once the free day is over, or without Plus', () => {
    expect(isStreakRestoreFree(free, new Date('2026-06-26T10:00:01.000Z'))).toBe(false);
    expect(isStreakRestoreFree(baseStatus(), new Date('2026-06-25T12:00:00.000Z'))).toBe(false);
  });
});

describe('withEffectiveStreakRestore', () => {
  it('clears can_restore_streak when the window expired', () => {
    const status = baseStatus();
    const effective = withEffectiveStreakRestore(status, new Date('2026-06-30T11:00:00.000Z'));
    expect(effective.can_restore_streak).toBe(false);
  });
});

describe('STREAK_RESTORE_WINDOW_MS', () => {
  it('is 5 days, the first of them free with Plus', () => {
    expect(STREAK_RESTORE_WINDOW_MS).toBe(5 * 86_400_000);
    expect(STREAK_RESTORE_FREE_MS).toBe(86_400_000);
  });
});

describe('parseStreakStatus', () => {
  it('keeps the freezes you hold and the days they covered', () => {
    const status = parseStreakStatus({
      relationship_id: 'r',
      current_streak: 9,
      streak_freezes: 1,
      frozen_days: ['2026-10-20', 'not-a-day'],
    });
    expect(status?.streak_freezes).toBe(1);
    expect(status?.frozen_days).toEqual(['2026-10-20']);
  });
});

describe('isPartnerStreakEndingSoon', () => {
  const evening = new Date('2026-08-03T22:00:00');
  const morning = new Date('2026-08-03T09:00:00');

  it('follows the server (their clock) when it says', () => {
    const status = { ...baseStatus(), partner_streak: 5, partner_at_risk: true, partner_ends_soon: false };
    expect(isPartnerStreakEndingSoon(status, evening)).toBe(false);
    expect(isPartnerStreakEndingSoon({ ...status, partner_ends_soon: true }, morning)).toBe(true);
  });

  it('uses your evening on older servers, and never once they’ve checked in', () => {
    const status = { ...baseStatus(), partner_streak: 5, partner_at_risk: true };
    expect(isPartnerStreakEndingSoon(status, morning)).toBe(false);
    expect(isPartnerStreakEndingSoon(status, evening)).toBe(true);
    expect(isPartnerStreakEndingSoon({ ...status, partner_active_today: true }, evening)).toBe(false);
  });
});
