import { describe, expect, it } from 'vitest';

import { formatChatDateLabel } from '@/lib/chat-list';

describe('formatChatDateLabel', () => {
  const now = new Date('2026-06-25T15:00:00');

  it('shows Today and Yesterday', () => {
    expect(formatChatDateLabel('2026-06-25T10:00:00', now.getTime())).toBe('Today');
    expect(formatChatDateLabel('2026-06-24T10:00:00', now.getTime())).toBe('Yesterday');
  });

  it('shows weekday for earlier this week', () => {
    expect(formatChatDateLabel('2026-06-23T10:00:00', now.getTime())).toBe('Tuesday');
    expect(formatChatDateLabel('2026-06-22T10:00:00', now.getTime())).toBe('Monday');
  });

  it('shows Last weekday for last week', () => {
    expect(formatChatDateLabel('2026-06-19T10:00:00', now.getTime())).toBe('Last Friday');
    expect(formatChatDateLabel('2026-06-16T10:00:00', now.getTime())).toBe('Last Tuesday');
    expect(formatChatDateLabel('2026-06-15T10:00:00', now.getTime())).toBe('Last Monday');
  });

  it('shows month and day for older dates this year', () => {
    expect(formatChatDateLabel('2026-03-10T10:00:00', now.getTime())).toBe('March 10');
  });

  it('shows full date for prior years', () => {
    expect(formatChatDateLabel('2025-12-01T10:00:00', now.getTime())).toBe('December 1, 2025');
  });
});
