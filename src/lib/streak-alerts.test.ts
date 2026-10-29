import { describe, expect, it } from 'vitest';

import { applyStreakScenario } from '@/lib/dev-streak-scenario';
import { emptyStreakStatus, streakRestoreMsLeft } from '@/lib/streak';
import { formatTimeLeft, showStreakEndsTonightCard } from '@/lib/streak-reminder-timing';

describe('Home streak cards', () => {
  const base = emptyStreakStatus('rel');

  it('shows "ends tonight" from 4pm until you check in', () => {
    const evening = new Date('2026-10-19T21:00:00');
    const risk = applyStreakScenario(base, 'at_risk', evening);
    expect(showStreakEndsTonightCard(risk, evening)).toBe(true);
    expect(showStreakEndsTonightCard(risk, new Date('2026-10-19T11:00:00'))).toBe(false);
    expect(showStreakEndsTonightCard({ ...risk, user_active_today: true }, evening)).toBe(false);
  });

  it('counts down the restore window', () => {
    const now = new Date('2026-10-19T12:00:00');
    const lost = applyStreakScenario(base, 'restore', now);
    // Lost two hours ago: 5 days to restore, so 4 days and 22 hours left.
    expect(streakRestoreMsLeft(lost, now)).toBe((5 * 24 - 2) * 3600_000);
  });

  it('writes time left simply', () => {
    expect(formatTimeLeft(3 * 3600_000 + 12 * 60_000)).toBe('3h 12m');
    expect(formatTimeLeft(35 * 60_000)).toBe('35m');
    expect(formatTimeLeft(10_000)).toBe('under a minute');
  });
});

describe('frozen days', () => {
  it('draws a day a streak freeze covered as frozen, and other missed days as missed', async () => {
    const { buildStreakWeek } = await import('@/lib/streak-days');
    const now = new Date('2026-10-21T12:00:00'); // a Wednesday
    const frozen = applyStreakScenario(emptyStreakStatus('rel'), 'frozen', now);
    const week = buildStreakWeek(frozen, '2026-01-01', now);
    expect(week.find((d) => d.dayOfMonth === 20)?.state).toBe('frozen');
    expect(week.find((d) => d.dayOfMonth === 19)?.state).toBe('completed');

    const lost = applyStreakScenario(emptyStreakStatus('rel'), 'restore', now);
    expect(buildStreakWeek(lost, '2026-01-01', now).find((d) => d.dayOfMonth === 20)?.state).toBe('missed');
  });
});
