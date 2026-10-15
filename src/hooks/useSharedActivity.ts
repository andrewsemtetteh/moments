import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { useRealtimeSubscription } from '@/hooks/queries';
import * as api from '@/services/api';
import { useRelationshipStore } from '@/stores';
import type { Activity } from '@/types/database';

/**
 * A couple activity both of you see and fill in (Gratitude swap, 7 day connection),
 * stored as rows in the shared `activities` table and kept live on both phones.
 */
export function useSharedActivities(type: string) {
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const queryClient = useQueryClient();
  // The activities realtime channel invalidates ['activities', relationshipId, …].
  useRealtimeSubscription('activities');

  const query = useQuery({
    queryKey: ['activities', relationshipId, type],
    queryFn: () => api.fetchActivitiesOfType(relationshipId!, type),
    enabled: !!relationshipId,
  });

  const refresh = useCallback(
    () => queryClient.invalidateQueries({ queryKey: ['activities', relationshipId, type] }),
    [queryClient, relationshipId, type],
  );

  return { ...query, rows: (query.data ?? []) as Activity[], relationshipId, refresh };
}
