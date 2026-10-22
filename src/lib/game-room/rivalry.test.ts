import { describe, expect, it } from 'vitest';

import { applyAward, emptyProgress } from '@/lib/play-progress';

import { bestSync, leadLine, previousSeason, readRivalry, rivalryAward } from './rivalry';
import type { RoomResult } from './types';

const win = (winnerId: string | null): RoomResult => ({
  winnerId,
  teamGame: false,
  headline: '',
  highlights: [],
  xp: 10,
});

function play(progress = emptyProgress('2026-10-01'), award: ReturnType<typeof rivalryAward>) {
  return applyAward(progress, { xp: 0, ...award }, '2026-10-05').progress;
}

describe('rivalry', () => {
  it('counts wins and ties all time and in the season', () => {
    let p = emptyProgress('2026-10-01');
    p = play(p, rivalryAward('quiz', win('a'), '2026-09'));
    p = play(p, rivalryAward('quiz', win('a'), '2026-10'));
    p = play(p, rivalryAward('twoTruths', win('b'), '2026-10'));
    p = play(p, rivalryAward('guessAnswer', win(null), '2026-10'));

    const r = readRivalry(p, 'a', 'b', '2026-10-19');
    expect(r.allTime).toEqual({ me: 2, them: 1, ties: 1 });
    expect(r.season).toEqual({ me: 1, them: 1, ties: 1, key: '2026-10' });
    expect(r.lastSeason).toEqual({ me: 1, them: 0, ties: 0, key: '2026-09', championId: 'a' });
    expect(r.champions.map((c) => c.key)).toEqual(['2026-09']);
  });

  it('keeps the best sync score, not a total', () => {
    const team = (syncPct: number): RoomResult => ({ ...win(null), teamGame: true, syncPct });
    let p = play(undefined, rivalryAward('thisOrThat', team(60)));
    p = play(p, rivalryAward('thisOrThat', team(40)));
    expect(bestSync(p, 'thisOrThat')).toBe(60);
    expect(bestSync(p, 'wouldYouRather')).toBeNull();
    // Team games never touch the head-to-head record.
    expect(readRivalry(p, 'a', 'b').allTime).toEqual({ me: 0, them: 0, ties: 0 });
  });

  it('rolls the season back over the new year', () => {
    expect(previousSeason('2026-01')).toBe('2025-12');
  });

  it('says who leads', () => {
    expect(leadLine({ me: 3, them: 1, ties: 0 }, 'Sam')).toBe('You lead 3–1');
    expect(leadLine({ me: 1, them: 4, ties: 0 }, 'Sam')).toBe('Sam leads 4–1');
    expect(leadLine({ me: 2, them: 2, ties: 1 }, 'Sam')).toBe('All square at 2');
  });
});
