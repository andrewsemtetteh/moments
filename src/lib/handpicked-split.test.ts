import { describe, expect, it } from 'vitest';

import {
  answerHome,
  hasPicks,
  MAX_PICK_QUESTIONS,
  MAX_TYPING_QUESTIONS,
  PACKS,
  partSizes,
  savedAs,
  splitPack,
  typingChunks,
  type AreaId,
  type PackQuestion,
} from '@/lib/handpicked';

const q = (id: string, text = `Question ${id}?`, picks?: string[]): PackQuestion => ({ id, text, picks });
const long = 'A question long enough to deserve a part on its own, because it asks for a real, thoughtful answer?';

describe('sets in parts', () => {
  it('splits multiple choice evenly, at most 10 a part', () => {
    expect(partSizes(10)).toEqual([10]);
    expect(partSizes(12)).toEqual([6, 6]);
    expect(partSizes(13)).toEqual([7, 6]);
  });

  it('typing questions come one or two at a time; a long one stands alone', () => {
    expect(typingChunks([q('1'), q('2'), q('3')]).map((c) => c.length)).toEqual([2, 1]);
    expect(typingChunks([q('1'), q('2', long), q('3'), q('4')]).map((c) => c.map((x) => x.id))).toEqual([
      ['1'],
      ['2'],
      ['3', '4'],
    ]);
  });

  it('every typing part has 1 or 2 questions, and no part mixes typing with options', () => {
    for (const pack of PACKS) {
      const typed = pack.questions.filter((x) => !hasPicks(x)).length;
      if (typed === 0) continue;
      expect(typed).toBe(pack.questions.length);
      expect(pack.questions.length).toBeGreaterThanOrEqual(1);
      expect(pack.questions.length).toBeLessThanOrEqual(MAX_TYPING_QUESTIONS);
    }
  });

  it('multiple-choice parts have at most 10', () => {
    for (const pack of PACKS.filter((p) => p.questions.every(hasPicks))) {
      expect(pack.questions.length).toBeLessThanOrEqual(MAX_PICK_QUESTIONS);
    }
  });

  it('a mixed set keeps its typing questions and sends its options questions to Quick picks', () => {
    const quick = new Map<AreaId, PackQuestion[]>();
    const set = {
      id: 'x',
      area: 'fun' as const,
      title: 'Set',
      depth: 'light' as const,
      questions: [q('1'), q('2', 'Pick one?', ['A', 'B']), q('3'), q('4')],
    };
    const parts = splitPack(set, quick);
    expect(parts.map((p) => p.questions.map((x) => x.id))).toEqual([['1', '3'], ['4']]);
    expect(parts.map((p) => p.id)).toEqual(['x', 'x-2']);
    expect(quick.get('fun')?.map((x) => x.from)).toEqual([{ packId: 'x', questionId: '2' }]);
  });

  it('keeps every question of every set, once', () => {
    const seen = new Set<string>();
    for (const pack of PACKS) {
      for (const x of pack.questions) {
        const saved = savedAs(pack, x);
        const key = `${saved.packId}/${saved.questionId}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
  });

  it('pack ids stay unique', () => {
    const ids = PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a saved answer shows in the part (or Quick picks) holding its question', () => {
    const part2 = PACKS.find((p) => p.sourceId && p.id !== p.sourceId)!;
    expect(answerHome({ pack_id: part2.sourceId!, question_id: part2.questions[0].id }).packId).toBe(part2.id);
    const quick = PACKS.find((p) => p.questions.some((x) => x.from))!;
    const moved = quick.questions.find((x) => x.from)!;
    expect(answerHome({ pack_id: moved.from!.packId, question_id: moved.from!.questionId })).toEqual({
      packId: quick.id,
      questionId: moved.id,
    });
    expect(answerHome({ pack_id: 'not-a-set', question_id: '1' })).toEqual({ packId: 'not-a-set', questionId: '1' });
  });
});
