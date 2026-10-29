import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { backend } from '@/lib/backend';
import { dayBefore, duelId, getDuel } from '@/lib/game-room/duel';
import { getSession, listActiveSessions } from '@/lib/game-room/sessions';
import { todayKey as localToday } from '@/lib/play-progress';
import { answerHome } from '@/lib/handpicked';
import { useAuthStore, useRelationshipStore } from '@/stores';

export interface PackAnswer {
  id: string;
  relationship_id: string;
  user_id: string;
  pack_id: string;
  question_id: string;
  choice: string | null;
  note: string | null;
  /** Guess quizzes: which pick you thought your partner would make. */
  guess?: string | null;
  created_at: string;
}

/** Own-time games still in progress for this couple. */
export function useActiveGameSessions() {
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  return useQuery({
    queryKey: ['gameSessions', relationshipId],
    queryFn: () => listActiveSessions(relationshipId!),
    enabled: !!relationshipId,
    staleTime: 15_000,
  });
}

export function useGameSession(id: string | undefined) {
  return useQuery({
    queryKey: ['gameSession', id],
    queryFn: () => getSession(id!),
    enabled: !!id,
  });
}

/**
 * Today's duel and yesterday's (still open until tonight), as they stand. Reading only: the duel is
 * created when one of you opens it. Live updates arrive through the game_sessions subscription.
 */
export function useDailyDuel() {
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const todayKey = localToday();
  const yesterdayKey = dayBefore(todayKey);
  const todayId = relationshipId ? duelId(relationshipId, todayKey) : undefined;
  const yesterdayId = relationshipId ? duelId(relationshipId, yesterdayKey) : undefined;
  const today = useQuery({
    queryKey: ['gameSession', todayId],
    queryFn: () => getDuel(todayId!),
    enabled: !!todayId,
    staleTime: 15_000,
  });
  const yesterday = useQuery({
    queryKey: ['gameSession', yesterdayId],
    queryFn: () => getDuel(yesterdayId!),
    enabled: !!yesterdayId,
    staleTime: 60_000,
  });
  return { today: today.data ?? null, yesterday: yesterday.data ?? null, todayKey, yesterdayKey };
}

/** Every locked-in Handpicked answer for this couple (both partners). */
export function usePackAnswers() {
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  return useQuery({
    queryKey: ['packAnswers', relationshipId],
    queryFn: async () => {
      const { data, error } = await backend
        .from('pack_answers')
        .select('*')
        .eq('relationship_id', relationshipId!)
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as PackAnswer[];
    },
    enabled: !!relationshipId,
    staleTime: 30_000,
  });
}

/**
 * Which questions each of you has answered, per pack as shown (a part, or Quick picks): the
 * lists use it for progress and for who's finished each set.
 */
export function useAnsweredByPack() {
  const { data: answers } = usePackAnswers();
  const userId = useAuthStore((s) => s.user?.id);
  return useMemo(() => {
    const mine = new Map<string, Set<string>>();
    const theirs = new Map<string, Set<string>>();
    for (const a of answers ?? []) {
      const home = answerHome(a);
      const byPack = a.user_id === userId ? mine : theirs;
      if (!byPack.has(home.packId)) byPack.set(home.packId, new Set());
      byPack.get(home.packId)!.add(home.questionId);
    }
    return { mine, theirs };
  }, [answers, userId]);
}

export function useLockPackAnswer() {
  const queryClient = useQueryClient();
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  return useMutation({
    mutationFn: async (input: {
      packId: string;
      questionId: string;
      choice: string | null;
      note: string | null;
      guess?: string | null;
    }) => {
      const { data, error } = await backend
        .from('pack_answers')
        .insert({
          relationship_id: relationshipId,
          pack_id: input.packId,
          question_id: input.questionId,
          choice: input.choice,
          note: input.note,
          ...(input.guess ? { guess: input.guess } : {}),
        })
        .select()
        .single();
      // A unique-constraint error means this question was already locked in on another device.
      if (error && !/unique/i.test(error.message)) throw error;
      return data as PackAnswer | null;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['packAnswers', relationshipId] }),
  });
}
