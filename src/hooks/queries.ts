import type { RealtimeChannel } from '@supabase/supabase-js';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';

import { isMissingTableError } from '@/lib/network-error';
import { supabase } from '@/lib/supabase';
import { scheduleWatchReminder } from '@/lib/watch-reminders';
import { AnalyticsEvents, track } from '@/services/analytics';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type {
    StreamingConnection,
    WatchlistItem,
    WatchSession,
    WatchVote,
} from '@/types/database';

export function useProfile() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => (user ? api.fetchProfile(user.id) : null),
    enabled: !!user,
  });
}

export function useRelationship() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['relationship', user?.id],
    queryFn: () => (user ? api.fetchRelationship(user.id) : { relationship: null, partner: null }),
    enabled: !!user,
  });
}

export function useMoments() {
  const relationship = useRelationshipStore((s) => s.relationship);
  return useInfiniteQuery({
    queryKey: ['moments', relationship?.id],
    queryFn: ({ pageParam }) =>
      api.fetchMoments(relationship!.id, 30, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length === 30 ? lastPage[lastPage.length - 1]?.created_at : undefined,
    enabled: !!relationship?.id,
  });
}

export function useMessages() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['messages', relationship?.id],
    queryFn: async () => {
      const rows = await api.fetchMessages(relationship!.id);
      return rows.filter((m) => !(m.hidden_for ?? []).includes(user!.id));
    },
    enabled: !!relationship?.id && !!user?.id,
    staleTime: 30_000,
  });
}

export function useUnreadMessageCount() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['unreadMessages', relationship?.id, user?.id],
    queryFn: () => api.fetchUnreadMessageCount(relationship!.id, user!.id),
    enabled: !!relationship?.id && !!user?.id,
    staleTime: 15_000,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (params: {
      content: string;
      mediaUrl?: string;
      mediaType?: string;
      momentId?: string;
      replyToId?: string;
    }) =>
      api.sendMessage(
        relationship!.id,
        user!.id,
        params.content,
        params.mediaUrl,
        params.mediaType,
        params.momentId,
        params.replyToId,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', relationship?.id] });
    },
  });
}

export function useActivities() {
  const relationship = useRelationshipStore((s) => s.relationship);
  return useQuery({
    queryKey: ['activities', relationship?.id],
    queryFn: () => api.fetchActivities(relationship!.id),
    enabled: !!relationship?.id,
  });
}

export function useCalendarEvents(month?: Date) {
  const relationship = useRelationshipStore((s) => s.relationship);
  return useQuery({
    queryKey: ['calendar', relationship?.id, month?.toISOString()],
    queryFn: () => api.fetchCalendarEvents(relationship!.id, month),
    enabled: !!relationship?.id,
  });
}

export function useUpcomingCalendarEvents() {
  const relationship = useRelationshipStore((s) => s.relationship);
  return useQuery({
    queryKey: ['calendarUpcoming', relationship?.id],
    queryFn: () => api.fetchUpcomingCalendarEvents(relationship!.id),
    enabled: !!relationship?.id,
  });
}

export function useJournalEntries() {
  const relationship = useRelationshipStore((s) => s.relationship);
  return useQuery({
    queryKey: ['journal', relationship?.id],
    queryFn: () => api.fetchJournalEntries(relationship!.id),
    enabled: !!relationship?.id,
  });
}

export function useCreateJournalEntry() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (entry: { content: string; type: string; is_private?: boolean }) =>
      api.createJournalEntry(relationship!.id, user!.id, entry),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['journal', relationship?.id] });
      queryClient.invalidateQueries({ queryKey: ['streak', relationship?.id] });
      if (relationship && user) {
        await api.trackEvent(relationship.id, user.id, 'journal_entry_created');
      }
    },
  });
}

export function useMoods() {
  const relationship = useRelationshipStore((s) => s.relationship);
  return useQuery({
    queryKey: ['moods', relationship?.id],
    queryFn: () => api.fetchLatestMoods(relationship!.id),
    enabled: !!relationship?.id,
    refetchInterval: 60_000,
  });
}

export function useMoodFrequency() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['moodFrequency', relationship?.id, user?.id],
    queryFn: () => api.fetchMoodFrequency(relationship!.id, user!.id),
    enabled: !!relationship?.id && !!user?.id,
  });
}

export function useStreak() {
  const relationship = useRelationshipStore((s) => s.relationship);
  return useQuery({
    queryKey: ['streak', relationship?.id],
    queryFn: () => api.fetchStreak(relationship!.id),
    enabled: !!relationship?.id,
  });
}

export function useDailyChallenge() {
  const relationship = useRelationshipStore((s) => s.relationship);
  return useQuery({
    queryKey: ['daily-challenge', relationship?.id],
    queryFn: () => api.fetchDailyChallenge(relationship!.id),
    enabled: !!relationship?.id,
  });
}

export function useBucketList() {
  const relationship = useRelationshipStore((s) => s.relationship);
  return useQuery({
    queryKey: ['bucket-list', relationship?.id],
    queryFn: () => api.fetchBucketList(relationship!.id),
    enabled: !!relationship?.id,
  });
}

export function useSharedGoals() {
  const relationship = useRelationshipStore((s) => s.relationship);
  return useQuery({
    queryKey: ['shared-goals', relationship?.id],
    queryFn: () => api.fetchSharedGoals(relationship!.id),
    enabled: !!relationship?.id,
  });
}

export function useExperiences() {
  return useQuery({
    queryKey: ['experiences'],
    queryFn: () => api.fetchExperiences(),
  });
}

export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['notifications', user?.id],
    queryFn: () => api.fetchNotifications(user!.id),
    enabled: !!user,
  });
}

function removeRelationshipChannel(channelName: string) {
  const topic = `realtime:${channelName}`;
  for (const existing of supabase.getChannels()) {
    if (existing.topic === topic) {
      void supabase.removeChannel(existing);
    }
  }
}

export function useRealtimeSubscription(
  table:
    | 'messages'
    | 'moments'
    | 'mood_logs'
    | 'activities'
    | 'notifications'
    | 'calendar_events'
    | 'watch_sessions'
    | 'watch_watchlist'
    | 'watch_messages',
) {
  const queryClient = useQueryClient();
  const queryClientRef = useRef(queryClient);
  queryClientRef.current = queryClient;
  const relationship = useRelationshipStore((s) => s.relationship);

  useEffect(() => {
    if (!relationship?.id) return;

    const channelName = `relationship:${relationship.id}:${table}`;
    removeRelationshipChannel(channelName);

    const channel: RealtimeChannel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: `relationship_id=eq.${relationship.id}`,
        },
        () => {
          const qc = queryClientRef.current;
          qc.invalidateQueries({ queryKey: [table === 'mood_logs' ? 'moods' : table.replace('_logs', ''), relationship.id] });
          if (table === 'messages') {
            qc.invalidateQueries({ queryKey: ['messages', relationship.id] });
            qc.invalidateQueries({ queryKey: ['unreadMessages', relationship.id] });
          }
          if (table === 'watch_sessions') {
            qc.invalidateQueries({ queryKey: ['watchSession', relationship.id] });
            qc.invalidateQueries({ queryKey: ['upcomingSessions', relationship.id] });
          }
          if (table === 'watch_watchlist') {
            qc.invalidateQueries({ queryKey: ['watchlist', relationship.id] });
          }
          if (table === 'watch_messages') {
            qc.invalidateQueries({ queryKey: ['watchMessages'] });
          }
          if (table === 'moments') qc.invalidateQueries({ queryKey: ['moments', relationship.id] });
          if (table === 'mood_logs') qc.invalidateQueries({ queryKey: ['moods', relationship.id] });
          if (table === 'calendar_events') {
            qc.invalidateQueries({ queryKey: ['calendar', relationship.id] });
            qc.invalidateQueries({ queryKey: ['calendarUpcoming', relationship.id] });
          }
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [relationship?.id, table]);
}

export function useGenerateActivity() {
  const relationship = useRelationshipStore((s) => s.relationship);
  return useMutation({
    mutationFn: (params: { mood: string; budget: number; time_available: number; distance?: string }) =>
      api.invokeEdgeFunction<{ activities: Array<{ title: string; type: string; description?: string }> }>(
        'generate-activity',
        { relationship_id: relationship!.id, ...params },
      ),
  });
}

export function useUpdateMood() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (mood: string) => api.updateMood(relationship!.id, user!.id, mood),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moods', relationship?.id] });
      queryClient.invalidateQueries({ queryKey: ['moodFrequency', relationship?.id, user?.id] });
    },
  });
}

export function useCreateMoment() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (moment: { type: 'photo' | 'video'; media_url: string }) =>
      api.createMoment(relationship!.id, user!.id, moment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moments', relationship?.id] });
      queryClient.invalidateQueries({ queryKey: ['streak', relationship?.id] });
    },
  });
}

export function useBucketMutations() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['bucket-list', relationship?.id] });

  const create = useMutation({
    mutationFn: (title: string) => api.createBucketListItem(relationship!.id, title),
    onSuccess: invalidate,
  });
  const toggle = useMutation({
    mutationFn: (item: { id: string; status: 'pending' | 'completed' }) =>
      api.updateBucketListItem(item.id, { status: item.status === 'completed' ? 'pending' : 'completed' }),
    onSuccess: invalidate,
  });
  return { create, toggle };
}

export function useGoalMutations() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['shared-goals', relationship?.id] });

  const create = useMutation({
    mutationFn: (title: string) => api.createSharedGoal(relationship!.id, title),
    onSuccess: invalidate,
  });
  const updateProgress = useMutation({
    mutationFn: (g: { id: string; progress: number }) =>
      api.updateSharedGoal(g.id, { progress: g.progress, status: g.progress >= 100 ? 'completed' : 'active' }),
    onSuccess: invalidate,
  });
  return { create, updateProgress };
}

export function useMessageActions() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['messages', relationship?.id] });

  const react = useMutation({
    mutationFn: (p: { messageId: string; emoji: string }) =>
      api.toggleMessageReaction(p.messageId, user!.id, p.emoji),
    onSuccess: invalidate,
  });
  const pin = useMutation({
    mutationFn: (p: { messageId: string; isPinned: boolean }) => api.setMessagePinned(p.messageId, p.isPinned),
    onSuccess: invalidate,
  });
  const deleteForMe = useMutation({
    mutationFn: (messageId: string) => api.hideMessageForUser(messageId, user!.id),
    onSuccess: invalidate,
  });
  const deleteForAll = useMutation({
    mutationFn: (messageId: string) => api.deleteMessageForAll(messageId, user!.id),
    onSuccess: invalidate,
  });
  return { react, pin, deleteForMe, deleteForAll };
}

export function useMomentReaction() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (p: { momentId: string; emoji: string }) =>
      api.toggleMomentReaction(p.momentId, user!.id, p.emoji),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['moments', relationship?.id] }),
  });
}

export function useActiveWatchSession() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const isOffline = useUIStore((s) => s.isOffline);
  return useQuery({
    queryKey: ['watchSession', relationship?.id],
    queryFn: () => (relationship ? api.fetchActiveWatchSession(relationship.id) : null),
    enabled: !!relationship?.id && !isOffline,
    refetchInterval: isOffline ? false : 15_000,
    retry: (count, error) => !isMissingTableError(error) && count < 1,
  });
}

export function useWatchMessages(sessionId: string | undefined) {
  const isOffline = useUIStore((s) => s.isOffline);
  return useQuery({
    queryKey: ['watchMessages', sessionId],
    queryFn: () => (sessionId ? api.fetchWatchMessages(sessionId) : []),
    enabled: !!sessionId && !isOffline,
    refetchInterval: isOffline ? false : 4_000,
    retry: (count, error) => !isMissingTableError(error) && count < 1,
  });
}

export function useSendWatchMessage(sessionId: string | undefined) {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (message: string) =>
      api.sendWatchMessage(sessionId!, relationship!.id, user!.id, message),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchMessages', sessionId] }),
  });
}

export function useWatchSessionMutations() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['watchSession', relationship?.id] });
    queryClient.invalidateQueries({ queryKey: ['upcomingSessions', relationship?.id] });
  };

  const create = useMutation({
    mutationFn: (payload: {
      title: string;
      link?: string;
      platformId?: string;
      contentId?: string;
      contentSource?: WatchSession['content_source'];
    }) => api.createWatchSession(relationship!.id, user!.id, { ...payload, status: 'watching' }),
    onSuccess: async (session) => {
      invalidate();
      if (relationship && user) {
        track({
          relationshipId: relationship.id,
          userId: user.id,
          eventType: AnalyticsEvents.WATCH_PARTY_CREATED,
          metadata: { platform: session.platform_id, title: session.title },
        });
      }
      if (partner && relationship) {
        track({
          relationshipId: relationship.id,
          userId: user!.id,
          eventType: AnalyticsEvents.WATCH_INVITATION_SENT,
        });
        await api.notifyWatchPartyStarted(
          relationship.id,
          partner.id,
          user?.name ?? 'Your partner',
          session.title,
        );
      }
    },
  });

  const schedule = useMutation({
    mutationFn: async (payload: {
      title: string;
      platformId?: string;
      scheduledAt: string;
      reminderMinutes?: number;
    }) => {
      const session = await api.createWatchSession(relationship!.id, user!.id, {
        title: payload.title,
        platformId: payload.platformId,
        scheduledAt: payload.scheduledAt,
        reminderMinutes: payload.reminderMinutes,
        status: 'scheduled',
      });
      if (payload.reminderMinutes != null) {
        await scheduleWatchReminder({
          title: payload.title,
          scheduledAt: new Date(payload.scheduledAt),
          reminderMinutes: payload.reminderMinutes,
        });
      }
      return session;
    },
    onSuccess: async (session) => {
      invalidate();
      if (relationship && user) {
        track({
          relationshipId: relationship.id,
          userId: user.id,
          eventType: AnalyticsEvents.WATCH_SCHEDULED,
          metadata: { title: session.title, scheduledAt: session.scheduled_at },
        });
      }
      if (partner && relationship && session.scheduled_at) {
        const whenLabel = new Date(session.scheduled_at).toLocaleString(undefined, {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
        });
        await api.notifyWatchPartyScheduled(
          relationship.id,
          partner.id,
          user?.name ?? 'Your partner',
          session.title,
          whenLabel,
        );
      }
    },
  });

  const startScheduled = useMutation({
    mutationFn: (sessionId: string) => api.startScheduledSession(sessionId, user!.id),
    onSuccess: invalidate,
  });

  const markReady = useMutation({
    mutationFn: (session: WatchSession) => api.markWatchReady(session.id, user!.id, session.ready_user_ids),
    onSuccess: invalidate,
  });

  const startCountdown = useMutation({
    mutationFn: (sessionId: string) => api.startWatchCountdown(sessionId),
    onSuccess: invalidate,
  });

  const beginWatching = useMutation({
    mutationFn: (sessionId: string) => api.beginWatching(sessionId),
    onSuccess: () => {
      invalidate();
      if (relationship && user) {
        track({
          relationshipId: relationship.id,
          userId: user.id,
          eventType: AnalyticsEvents.WATCH_SESSION_STARTED,
        });
      }
    },
  });

  const setPlayback = useMutation({
    mutationFn: (p: { sessionId: string; state: WatchSession['playback_state']; position?: number }) =>
      api.setWatchPlayback(p.sessionId, p.state, p.position),
    onSuccess: invalidate,
  });

  const react = useMutation({
    mutationFn: (p: { session: WatchSession; emoji: string }) =>
      api.addWatchReaction(p.session.id, p.session.reactions ?? [], user!.id, p.emoji),
    onSuccess: () => {
      invalidate();
      if (relationship && user) {
        track({
          relationshipId: relationship.id,
          userId: user.id,
          eventType: AnalyticsEvents.WATCH_REACTION_SENT,
        });
      }
    },
  });

  const end = useMutation({
    mutationFn: (sessionId: string) => api.endWatchSession(sessionId),
    onSuccess: () => {
      invalidate();
      if (relationship && user) {
        track({
          relationshipId: relationship.id,
          userId: user.id,
          eventType: AnalyticsEvents.WATCH_SESSION_COMPLETED,
        });
      }
    },
  });

  return { create, schedule, startScheduled, markReady, startCountdown, beginWatching, setPlayback, react, end };
}

export function useUpcomingSessions() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const isOffline = useUIStore((s) => s.isOffline);
  return useQuery({
    queryKey: ['upcomingSessions', relationship?.id],
    queryFn: () => (relationship ? api.fetchUpcomingSessions(relationship.id) : []),
    enabled: !!relationship?.id && !isOffline,
    retry: (count, error) => !isMissingTableError(error) && count < 1,
  });
}

export function useWatchlist() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const isOffline = useUIStore((s) => s.isOffline);
  return useQuery({
    queryKey: ['watchlist', relationship?.id],
    queryFn: () => (relationship ? api.fetchWatchlist(relationship.id) : []),
    enabled: !!relationship?.id && !isOffline,
    retry: (count, error) => !isMissingTableError(error) && count < 1,
  });
}

export function useWatchlistMutations() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['watchlist', relationship?.id] });

  const add = useMutation({
    mutationFn: (payload: { title: string; platformId?: string; note?: string }) =>
      api.addWatchlistItem(relationship!.id, user!.id, payload),
    onSuccess: () => {
      invalidate();
      if (relationship && user) {
        track({
          relationshipId: relationship.id,
          userId: user.id,
          eventType: AnalyticsEvents.WATCH_CONTENT_ADDED,
        });
      }
    },
  });

  const vote = useMutation({
    mutationFn: (p: { item: WatchlistItem; vote: WatchVote }) =>
      api.voteWatchlistItem(p.item.id, p.item.votes ?? {}, user!.id, p.vote),
    onSuccess: invalidate,
  });

  const setWatched = useMutation({
    mutationFn: (p: { itemId: string; watched: boolean }) =>
      api.setWatchlistWatched(p.itemId, p.watched),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (itemId: string) => api.removeWatchlistItem(itemId),
    onSuccess: invalidate,
  });

  return { add, vote, setWatched, remove };
}

export function useWatchHistory() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const isOffline = useUIStore((s) => s.isOffline);
  return useQuery({
    queryKey: ['watchHistory', relationship?.id],
    queryFn: () => (relationship ? api.fetchWatchHistory(relationship.id) : []),
    enabled: !!relationship?.id && !isOffline,
    retry: (count, error) => !isMissingTableError(error) && count < 1,
  });
}

export function useAddWatchHistory() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  return useMutation({
    mutationFn: (payload: {
      title: string;
      platformId?: string | null;
      contentId?: string | null;
      rating?: number;
      favoriteMoment?: string;
      promptQuestion?: string;
      promptAnswer?: string;
    }) => api.addWatchHistoryEntry(relationship!.id, user!.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['watchHistory', relationship?.id] });
    },
  });
}

export function useWatchPartyConnections() {
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const isOffline = useUIStore((s) => s.isOffline);

  return useQuery({
    queryKey: ['streamingConnections', user?.id, partner?.id],
    queryFn: async () => {
      if (!user) return { mine: [], partner: [] as StreamingConnection[] };
      const mine = await api.fetchStreamingConnections(user.id);
      const partnerList = partner ? await api.fetchStreamingConnections(partner.id) : [];
      return { mine, partner: partnerList };
    },
    enabled: !!user?.id && !isOffline,
    retry: (count, error) => !isMissingTableError(error) && count < 1,
  });
}

export function useStreamingConnectionMutations() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['streamingConnections', user?.id, partner?.id] });

  const connect = useMutation({
    mutationFn: (p: { platformId: string; accountLabel?: string }) =>
      api.connectStreamingPlatform(user!.id, p.platformId, p.accountLabel),
    onSuccess: invalidate,
  });

  return { connect };
}

export function useWatchPartyNudge() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);

  return useMutation({
    mutationFn: async () => {
      if (!relationship || !partner || !user) return;
      await api.nudgePartnerToWatchParty(relationship.id, partner.id, user.name ?? 'Your partner');
    },
  });
}
