import { describe, expect, it, vi } from 'vitest';

import { DUEL_QUESTIONS } from './duel-questions';
import { DUEL_SIZE, dayBefore, duelOpen, duelQuestions, newDuel, submitDuel } from './duel';

// vi.mock is hoisted above the imports: the duel's network and store calls stay out of these tests.
vi.mock('@/lib/backend', () => ({ backend: {} }));
vi.mock('@/services/api', () => ({ sendPartnerNotification: vi.fn() }));
vi.mock('@/stores/play-progress-store', () => ({ usePlayProgressStore: { getState: () => ({ award: vi.fn() }) } }));


const A = { id: 'a', name: 'Ada' };
const B = { id: 'b', name: 'Ben' };

describe('daily duel', () => {
  it('gives you both the same three questions, and new ones the next day', () => {
    const today = duelQuestions('rel1', '2026-10-19');
    expect(today).toHaveLength(DUEL_SIZE);
    expect(duelQuestions('rel1', '2026-10-19')).toEqual(today);
    expect(duelQuestions('rel1', '2026-10-20')).not.toEqual(today);
  });

  it('runs a month before a question comes back', () => {
    const seen = new Set<string>();
    const days = Math.floor(DUEL_QUESTIONS.length / DUEL_SIZE);
    for (let d = 0; d < days; d++) {
      const date = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
      for (const q of duelQuestions('rel1', date)) seen.add(q.question);
    }
    expect(seen.size).toBe(days * DUEL_SIZE);
  });

  it('scores once both have answered, and only takes your answers once', () => {
    let s = newDuel('rel1', '2026-10-19', [A, B]);
    const right = s.questions.map((q) => q.correctIndex);
    const wrong = s.questions.map((q) => (q.correctIndex + 1) % q.options.length);

    s = submitDuel(s, A.id, right);
    expect(s.result).toBeNull();
    expect(submitDuel(s, A.id, wrong)).toBe(s);
    expect(submitDuel(s, B.id, [0])).toBe(s);

    s = submitDuel(s, B.id, [right[0], wrong[1], wrong[2]]);
    expect(s.result).toEqual({ winnerId: 'a', scores: { a: 3, b: 1 } });
  });

  it('is a tie on level scores', () => {
    let s = newDuel('rel1', '2026-10-19', [A, B]);
    const right = s.questions.map((q) => q.correctIndex);
    s = submitDuel(submitDuel(s, A.id, right), B.id, right);
    expect(s.result?.winnerId).toBeNull();
  });

  it('stays open through the next day', () => {
    expect(dayBefore('2026-11-01')).toBe('2026-10-31');
    expect(duelOpen('2026-10-19', '2026-10-19')).toBe(true);
    expect(duelOpen('2026-10-18', '2026-10-19')).toBe(true);
    expect(duelOpen('2026-10-17', '2026-10-19')).toBe(false);
  });
});
