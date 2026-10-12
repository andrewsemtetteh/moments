import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { backend } from '@/lib/backend';
import { getSession, listActiveSessions } from '@/lib/game-room/sessions';
import { useRelationshipStore } from '@/stores';

export interface PackAnswer {
  id: string;
  relationship_id: string;
  user_id: string;
  pack_id: string;
  question_id: string;
  choice: string | null;
  note: string | null;
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

export function useLockPackAnswer() {
  const queryClient = useQueryClient();
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  return useMutation({
    mutationFn: async (input: { packId: string; questionId: string; choice: string | null; note: string | null }) => {
      const { data, error } = await backend
        .from('pack_answers')
        .insert({
          relationship_id: relationshipId,
          pack_id: input.packId,
          question_id: input.questionId,
          choice: input.choice,
          note: input.note,
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
