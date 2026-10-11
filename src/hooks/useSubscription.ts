import { startOfDay } from 'date-fns';
import { useMemo } from 'react';

import {
  FREE_AI_REQUESTS,
  FREE_DAILY_MOMENTS,
  FREE_TIMELINE_MOMENTS,
} from '@/constants/design-system';
import {
  canManageBilling,
  getEffectiveTier,
  hasActiveUserSubscription,
  isSubscriptionOwner,
} from '@/lib/subscription';
import { useMoments } from '@/hooks/queries';
import { useAuthStore, useRelationshipStore } from '@/stores';

export type Entitlement = 'free' | 'plus';

export function useSubscription() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  const tier = getEffectiveTier(user, relationship);
  const isPlus = tier === 'plus';
  const { data: momentsData } = useMoments();

  const dailyMomentsUsed = useMemo(() => {
    const today = startOfDay(new Date());
    const all = momentsData?.pages.flat() ?? [];
    return all.filter((m) => m.user_id === user?.id && new Date(m.created_at) >= today).length;
  }, [momentsData, user?.id]);

  return {
    tier,
    isPlus,
    isOwner: isSubscriptionOwner(user?.id, relationship),
    canManageBilling: canManageBilling(user?.id, relationship, user),
    hasPersonalSubscription: hasActiveUserSubscription(user),
    dailyMomentsUsed,
    limits: {
      dailyMoments: isPlus ? Infinity : FREE_DAILY_MOMENTS,
      aiRequests: isPlus ? Infinity : FREE_AI_REQUESTS,
      timelineMoments: isPlus ? Infinity : FREE_TIMELINE_MOMENTS,
      wrapped: true,
      moodHistory: true,
    },
  };
}
