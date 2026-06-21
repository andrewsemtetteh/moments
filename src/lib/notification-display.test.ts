import { describe, expect, it } from 'vitest';

import { formatNotificationTime } from '@/lib/notification-display';

describe('formatNotificationTime', () => {
  it('shows seconds for very recent items', () => {
    const now = Date.now();
    const iso = new Date(now - 50_000).toISOString();
    expect(formatNotificationTime(iso, now)).toBe('50s ago');
  });

  it('shows minutes for recent items', () => {
    const now = Date.now();
    const iso = new Date(now - 15 * 60_000).toISOString();
    expect(formatNotificationTime(iso, now)).toBe('15 min ago');
  });

  it('shows hours for same-calendar-day items', () => {
    const now = new Date();
    now.setHours(15, 0, 0, 0);
    const earlier = new Date(now);
    earlier.setHours(12, 0, 0, 0);
    expect(formatNotificationTime(earlier.toISOString(), now.getTime())).toBe('3 hr ago');
  });

  it('shows yesterday with clock time', () => {
    const now = new Date();
    now.setHours(15, 0, 0, 0);
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(18, 30, 0, 0);
    expect(formatNotificationTime(yesterday.toISOString(), now.getTime())).toMatch(/^Yesterday ·/);
  });
});
