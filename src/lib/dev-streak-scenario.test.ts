import { describe, expect, it } from 'vitest';

import { applyStreakScenario } from '@/lib/dev-streak-scenario';
import { emptyStreakStatus, isStreakRestoreAvailable } from '@/lib/streak';

describe('developer streak previews', () => {
  const now = new Date('2026-10-19T20:00:00');
  const base = { ...emptyStreakStatus('rel'), current_streak: 5, longest_streak: 5 };

  it('at risk: a streak up to yesterday, not yet today', () => {
    const s = applyStreakScenario(base, 'at_risk', now);
    expect(s.at_risk).toBe(true);
    expect(s.current_streak).toBe(12);
    expect(s.user_active_today).toBe(false);
    expect(s.last_active_date).toBe('2026-10-18');
  });

  it('restore: a lost streak the restore banner offers back', () => {
    const s = applyStreakScenario(base, 'restore', now);
    expect(s.current_streak).toBe(0);
    expect(s.restorable_streak).toBe(12);
    expect(isStreakRestoreAvailable(s, now)).toBe(true);
  });
});
