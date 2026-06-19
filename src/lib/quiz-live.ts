import type { QuizLiveQuestion, QuizLiveSession } from '@/types/database';

export const QUIZ_TOPIC_PRESETS = [
  'Pop culture',
  'Science & nature',
  'Movies & TV',
  'Food & travel',
  'About us',
  'Random fun facts',
] as const;

export const QUIZ_TILE_COLORS = ['#E21B3C', '#1368CE', '#D89E00', '#26890C'] as const;
export const BOOL_TILE_COLORS = ['#1368CE', '#E21B3C'] as const;

export function parseQuizQuestions(raw: unknown): QuizLiveQuestion[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (q): q is QuizLiveQuestion =>
      !!q &&
      typeof q === 'object' &&
      typeof (q as QuizLiveQuestion).question === 'string' &&
      ((q as QuizLiveQuestion).type === 'choice' || (q as QuizLiveQuestion).type === 'boolean') &&
      Array.isArray((q as QuizLiveQuestion).options),
  );
}

export function getRoundResponses(session: QuizLiveSession, index: number): Record<string, number> {
  const key = String(index);
  const bucket = session.responses?.[key];
  if (!bucket || typeof bucket !== 'object') return {};
  return bucket as Record<string, number>;
}

export function bothAnswered(session: QuizLiveSession, memberIds: string[]): boolean {
  const answers = getRoundResponses(session, session.current_index);
  return memberIds.every((id) => typeof answers[id] === 'number');
}

export function computeRoundPoints(
  question: QuizLiveQuestion,
  myAnswer: number,
  partnerAnswer?: number,
): number {
  if (question.correctIndex !== undefined) {
    return myAnswer === question.correctIndex ? 1 : 0;
  }
  if (partnerAnswer !== undefined && myAnswer === partnerAnswer) {
    return 1;
  }
  return 0;
}

export function mergeScores(
  current: Record<string, number>,
  userId: string,
  points: number,
): Record<string, number> {
  return { ...current, [userId]: (current[userId] ?? 0) + points };
}

export function clientFallbackQuestions(topic: string): QuizLiveQuestion[] {
  return [
    {
      question: `Which best matches “${topic}”?`,
      type: 'choice',
      options: ['First pick', 'Second pick', 'Third pick', 'Fourth pick'],
      correctIndex: 1,
    },
    { question: 'True or false: this topic is fun to quiz on.', type: 'boolean', options: ['True', 'False'], correctIndex: 0 },
    {
      question: `Another question about ${topic}.`,
      type: 'choice',
      options: ['A', 'B', 'C', 'D'],
      correctIndex: 2,
    },
    { question: 'The moon is a star.', type: 'boolean', options: ['True', 'False'], correctIndex: 1 },
    {
      question: `Quick ${topic} check.`,
      type: 'choice',
      options: ['One', 'Two', 'Three', 'Four'],
      correctIndex: 0,
    },
    { question: 'Water boils at 100°C at sea level.', type: 'boolean', options: ['True', 'False'], correctIndex: 0 },
  ];
}
