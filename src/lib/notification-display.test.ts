import { describe, expect, it } from 'vitest';

import {
  filterInboxNotifications,
  formatNotificationTime,
  notificationSectionTitle,
} from '@/lib/notification-display';

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
    expect(formatNotificationTime(yesterday.toISOString(), now.getTime())).toMatch(/, yesterday$/i);
  });
});

describe('notificationSectionTitle', () => {
  it('labels today and yesterday', () => {
    const ref = new Date(2026, 5, 15, 15, 0, 0);
    expect(notificationSectionTitle(new Date(2026, 5, 15, 10, 0, 0).toISOString(), ref.getTime())).toBe(
      'Today',
    );
    expect(notificationSectionTitle(new Date(2026, 5, 14, 10, 0, 0).toISOString(), ref.getTime())).toBe(
      'Yesterday',
    );
  });

  it('labels items within 7 days as previous 7 days', () => {
    const ref = new Date(2026, 5, 15, 15, 0, 0);
    const threeDaysAgo = new Date(2026, 5, 12, 10, 0, 0);
    expect(notificationSectionTitle(threeDaysAgo.toISOString(), ref.getTime())).toBe('Previous 7 days');
  });

  it('labels items within 30 days as previous 30 days', () => {
    const ref = new Date(2026, 5, 15, 15, 0, 0);
    const twentyDaysAgo = new Date(2026, 4, 26, 10, 0, 0);
    expect(notificationSectionTitle(twentyDaysAgo.toISOString(), ref.getTime())).toBe('Previous 30 days');
  });

  it('labels older items by month and year', () => {
    const ref = new Date(2026, 5, 15, 15, 0, 0);
    const lastYear = new Date(2025, 10, 1, 10, 0, 0);
    expect(notificationSectionTitle(lastYear.toISOString(), ref.getTime())).toBe('November 2025');

    const older = new Date(2024, 2, 1, 10, 0, 0);
    expect(notificationSectionTitle(older.toISOString(), ref.getTime())).toBe('March 2024');
  });
});

describe('filterInboxNotifications', () => {
  it('excludes chat message notifications', () => {
    const items = [
      { id: '1', type: 'moment' as const },
      { id: '2', type: 'message' as const },
      { id: '3', type: 'message_new' as const },
      { id: '4', type: 'streak' as const },
    ];
    expect(filterInboxNotifications(items).map((n) => n.id)).toEqual(['1', '4']);
  });
});
