import type { RealtimeChannel } from '@supabase/supabase-js';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { Alert } from 'react-native';

import { isMissingTableError, toUserFacingNetworkError, getErrorMessage } from '@/lib/network-error';
import type { MoodHistoryFilter } from '@/lib/mood-history';
import { resolveMoodFilterUserId as resolveMoodHistoryUserId } from '@/lib/mood-history';
import { getEffectiveTier } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import { scheduleWatchReminder } from '@/lib/watch-reminders';
import { AnalyticsEvents, track } from '@/services/analytics';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type {
    Message,
    MoodLog,
    Notification,
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

export function useSharedAlbum() {
  const relationship = useRelationshipStore((s) => s.relationship);
  return useQuery({
    queryKey: ['shared-album', relationship?.id],
    queryFn: () => api.fetchSharedAlbumItems(relationship!.id),
    enabled: !!relationship?.id,
  });
}

export function useSharedAlbumStorage() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const { data: items } = useSharedAlbum();
  const usedBytes = useMemo(
    () => (items ?? []).reduce((sum, item) => sum + Number(item.file_size_bytes ?? 0), 0),
    [items],
  );
  return { usedBytes, itemCount: items?.length ?? 0 };
}

export function useUploadSharedAlbumItem() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  const isPlus = getEffectiveTier(user, relationship) === 'plus';

  return useMutation({
    mutationFn: (payload: {
      uri: string;
      mediaType: 'photo' | 'video';
      fileSizeBytes?: number;
      caption?: string | null;
    }) =>
      api.createSharedAlbumItem(relationship!.id, user!.id, payload, { isPlus }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-album', relationship?.id] });
    },
  });
}

export function useDeleteSharedAlbumItem() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (itemId: string) => api.deleteSharedAlbumItem(itemId, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shared-album', relationship?.id] });
    },
  });
}

const MESSAGES_PAGE_SIZE = 50;

export function useInfiniteMessages() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);

  return useInfiniteQuery({
    queryKey: ['messages', relationship?.id],
    queryFn: ({ pageParam }) =>
      api.fetchMessages(relationship!.id, MESSAGES_PAGE_SIZE, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length < MESSAGES_PAGE_SIZE ? undefined : lastPage[0]?.created_at,
    enabled: !!relationship?.id && !!user?.id,
    staleTime: 30_000,
    select: (data) => ({
      ...data,
      pages: data.pages.map((page) => page.filter((m) => !(m.hidden_for ?? []).includes(user!.id))),
    }),
  });
}

/** @deprecated use useInfiniteMessages — kept for callers that need a flat list */
export function useMessages() {
  const query = useInfiniteMessages();
  const messages = useMemo(
    () => query.data?.pages.reduceRight<Message[]>((acc, page) => [...page, ...acc], []) ?? [],
    [query.data?.pages],
  );
  return { ...query, data: messages };
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
  const partner = useRelationshipStore((s) => s.partner);

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
        { partnerUserId: partner?.id, senderName: user?.name },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', relationship?.id] });
      queryClient.invalidateQueries({ queryKey: ['unreadMessages', relationship?.id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['streak', relationship?.id] });
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
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['moods', relationship?.id],
    queryFn: () => {
      const rel = useRelationshipStore.getState().relationship;
      const currentUser = useAuthStore.getState().user;
      const memberIds = rel
        ? ([rel.user_1_id, rel.user_2_id, currentUser?.id].filter(Boolean) as string[])
        : currentUser?.id
          ? [currentUser.id]
          : undefined;
      return api.fetchLatestMoods(relationship!.id, memberIds);
    },
    enabled: !!relationship?.id && !!user?.id,
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

export function useMoodHistory(filter: MoodHistoryFilter) {
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const filterUserId = resolveMoodHistoryUserId(filter, user?.id ?? '', partner?.id);

  return useInfiniteQuery({
    queryKey: ['moodHistory', relationship?.id, filterUserId],
    queryFn: ({ pageParam }) =>
      api.fetchMoodHistoryPage(relationship!.id, {
        before: pageParam as string | undefined,
        filterUserId,
        limit: 50,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length === 50 ? lastPage[lastPage.length - 1]?.created_at : undefined,
    enabled: !!relationship?.id && (filter !== 'partner' || !!partner?.id),
  });
}

export function useMoodHistoryOverview(filter: MoodHistoryFilter) {
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);

  return useQuery({
    queryKey: ['moodHistoryOverview', relationship?.id, filter, user?.id, partner?.id],
    queryFn: () =>
      api.fetchMoodHistoryOverview(relationship!.id, {
        filter,
        userId: user!.id,
        partnerId: partner?.id,
      }),
    enabled: !!relationship?.id && !!user?.id && (filter !== 'partner' || !!partner?.id),
    staleTime: 30_000,
  });
}

export function useRestoreStreak() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);

  return useMutation({
    mutationFn: () => api.restoreStreak(relationship!.id),
    onSuccess: (status) => {
      queryClient.setQueryData(['streak', relationship?.id], status);
      queryClient.invalidateQueries({ queryKey: ['streak', relationship?.id] });
    },
  });
}

export function useStreak() {
  const relationship = useRelationshipStore((s) => s.relationship);

  return useQuery({
    queryKey: ['streak', relationship?.id],
    queryFn: async () => {
      const status = await api.fetchStreakStatus(relationship!.id);
      void import('@/lib/push-notifications').then(({ dispatchPendingPushNotifications }) =>
        dispatchPendingPushNotifications(),
      );
      return status;
    },
    enabled: !!relationship?.id,
    staleTime: 30_000,
    refetchInterval: 5 * 60_000,
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

// Experiences marketplace paused — re-enable when backend is ready.
/*
export function useExperiences() {
  return useQuery({
    queryKey: ['experiences'],
    queryFn: () => api.fetchExperiences(),
  });
}

export function useSavedExperienceIds() {
  const relationship = useRelationshipStore((s) => s.relationship);
  return useQuery({
    queryKey: ['saved-experiences', relationship?.id],
    queryFn: () => api.fetchSavedExperienceIds(relationship!.id),
    enabled: !!relationship?.id,
  });
}

export function useExperienceMutations() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['saved-experiences', relationship?.id] });

  const save = useMutation({
    mutationFn: (experienceId: string) => api.saveExperience(relationship!.id, experienceId),
    onSuccess: invalidate,
  });
  const unsave = useMutation({
    mutationFn: (experienceId: string) => api.unsaveExperience(relationship!.id, experienceId),
    onSuccess: invalidate,
  });
  return { save, unsave };
}
*/

export function useNotificationFeed() {
  const user = useAuthStore((s) => s.user);
  return useInfiniteQuery({
    queryKey: ['notifications', user?.id, 'feed'],
    queryFn: ({ pageParam }) =>
      api.fetchNotificationsPage(user!.id, {
        before: pageParam as string | undefined,
        limit: 30,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length === 30 ? lastPage[lastPage.length - 1]?.created_at : undefined,
    enabled: !!user?.id,
  });
}

/** Flat list wrapper — used by NotificationSync and legacy callers. */
export function useNotifications() {
  const feed = useNotificationFeed();
  const data = useMemo(() => feed.data?.pages.flat(), [feed.data]);
  return {
    ...feed,
    data,
  };
}

export function useUnreadNotificationCount() {
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['notificationUnreadCount', user?.id],
    queryFn: () => api.fetchUnreadNotificationCount(user!.id),
    enabled: !!user?.id,
    staleTime: 15_000,
  });
}

function invalidateNotificationQueries(queryClient: ReturnType<typeof useQueryClient>, userId?: string) {
  if (userId) {
    queryClient.invalidateQueries({ queryKey: ['notifications', userId] });
    queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount', userId] });
  } else {
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] });
  }
}

let notificationInvalidateTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedInvalidateNotificationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  userId?: string,
) {
  if (notificationInvalidateTimer) clearTimeout(notificationInvalidateTimer);
  notificationInvalidateTimer = setTimeout(() => {
    notificationInvalidateTimer = null;
    invalidateNotificationQueries(queryClient, userId);
  }, 400);
}

export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (notificationIds?: string[]) => api.markNotificationsRead(notificationIds),
    onSuccess: (_data, notificationIds) => {
      const userId = user?.id;
      if (userId) {
        queryClient.setQueryData<{ pages: Notification[][]; pageParams: unknown[] }>(
          ['notifications', userId, 'feed'],
          (old) => {
            if (!old) return old;
            const markAll = !notificationIds?.length;
            const idSet = new Set(notificationIds ?? []);
            return {
              ...old,
              pages: old.pages.map((page) =>
                page.map((n) =>
                  markAll || idSet.has(n.id) ? { ...n, read: true } : n,
                ),
              ),
            };
          },
        );
        if (!notificationIds?.length) {
          queryClient.setQueryData(['notificationUnreadCount', userId], 0);
        } else {
          queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount', userId] });
        }
      }
    },
  });
}

export function useDeleteNotification() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (notificationId: string) => api.deleteNotification(notificationId, user!.id),
    onSuccess: () => {
      invalidateNotificationQueries(queryClient, user?.id);
    },
  });
}

export function useClearNotifications() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: () => api.clearAllNotifications(user!.id),
    onSuccess: () => {
      invalidateNotificationQueries(queryClient, user?.id);
    },
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
    | 'watch_messages'
    | 'quiz_live_sessions'
    | 'streaks',
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
            const userId = useAuthStore.getState().user?.id;
            qc.invalidateQueries({ queryKey: ['unreadMessages', relationship.id, userId] });
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
          if (table === 'quiz_live_sessions') {
            qc.invalidateQueries({ queryKey: ['quizLiveSession', relationship.id] });
          }
          if (table === 'moments') qc.invalidateQueries({ queryKey: ['moments', relationship.id] });
          if (table === 'mood_logs') {
            qc.invalidateQueries({ queryKey: ['moods', relationship.id] });
            qc.invalidateQueries({ queryKey: ['moodHistory', relationship.id] });
            qc.invalidateQueries({ queryKey: ['moodHistoryOverview', relationship.id] });
            const userId = useAuthStore.getState().user?.id;
            qc.invalidateQueries({ queryKey: ['moodFrequency', relationship.id, userId] });
          }
          if (table === 'calendar_events') {
            qc.invalidateQueries({ queryKey: ['calendar', relationship.id] });
            qc.invalidateQueries({ queryKey: ['calendarUpcoming', relationship.id] });
          }
          if (table === 'streaks') {
            qc.invalidateQueries({ queryKey: ['streak', relationship.id] });
          }
          if (table === 'notifications') {
            const userId = useAuthStore.getState().user?.id;
            debouncedInvalidateNotificationQueries(qc, userId);
            void import('@/lib/push-notifications').then(({ dispatchPendingPushNotifications }) =>
              dispatchPendingPushNotifications(),
            );
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
    mutationFn: async (mood: string) => {
      const authUser = useAuthStore.getState().user;
      if (!authUser?.id) throw new Error('Not signed in');

      const { relationship: fresh, partner } = await api.fetchRelationship(authUser.id);
      const relId = fresh?.id ?? relationship?.id;
      if (!relId) throw new Error('Connect with your partner before logging a mood.');

      if (fresh) useRelationshipStore.getState().setRelationship(fresh);
      if (partner) useRelationshipStore.getState().setPartner(partner);

      return api.updateMood(relId, mood);
    },
    onMutate: async (mood) => {
      if (!relationship?.id || !user?.id) return;
      const queryKey = ['moods', relationship.id] as const;
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<Record<string, MoodLog>>(queryKey);
      queryClient.setQueryData<Record<string, MoodLog>>(queryKey, {
        ...previous,
        [user.id]: {
          ...(previous?.[user.id] ?? {}),
          id: previous?.[user.id]?.id ?? `optimistic-${user.id}`,
          relationship_id: relationship.id,
          user_id: user.id,
          mood: mood as MoodLog['mood'],
          created_at: new Date().toISOString(),
        },
      });
      return { previous };
    },
    onError: (error, _mood, context) => {
      if (relationship?.id && context?.previous !== undefined) {
        queryClient.setQueryData(['moods', relationship.id], context.previous);
      }
      const message = getErrorMessage(error) ?? toUserFacingNetworkError(error, 'Could not save your mood. Please try again.').message;
      Alert.alert('Mood not saved', message);
    },
    onSuccess: (data) => {
      if (relationship?.id) {
        queryClient.setQueryData<Record<string, MoodLog>>(['moods', relationship.id], (old) => ({
          ...old,
          [data.user_id]: data,
        }));
      }
      queryClient.invalidateQueries({ queryKey: ['moodFrequency', relationship?.id, user?.id] });
      queryClient.invalidateQueries({ queryKey: ['moodHistory', relationship?.id] });
      queryClient.invalidateQueries({ queryKey: ['moodHistoryOverview', relationship?.id] });
      queryClient.invalidateQueries({ queryKey: ['streak', relationship?.id] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void import('@/lib/push-notifications').then(({ dispatchPendingPushNotifications }) =>
        dispatchPendingPushNotifications(),
      );
    },
  });
}

export function useCreateMoment() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (moment: { type: 'photo' | 'video'; media_url: string }) => {
      const partnerUserId =
        relationship!.user_1_id === user!.id ? relationship!.user_2_id : relationship!.user_1_id;
      return api.createMoment(relationship!.id, user!.id, moment, {
        senderName: user!.name,
        partnerUserId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moments', relationship?.id] });
      queryClient.invalidateQueries({ queryKey: ['streak', relationship?.id] });
    },
  });
}

export function useDeleteMoments() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: (momentIds: string[]) => api.deleteMoments(momentIds, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moments', relationship?.id] });
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
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['messages', relationship?.id] });
    queryClient.invalidateQueries({ queryKey: ['unreadMessages', relationship?.id, user?.id] });
  };
  const onError = (error: Error) => {
    void import('react-native').then(({ Alert }) =>
      Alert.alert('Could not update message', error.message || 'Please try again.'),
    );
  };

  const react = useMutation({
    mutationFn: (p: { messageId: string; emoji: string }) =>
      api.toggleMessageReaction(p.messageId, user!.id, p.emoji),
    onSuccess: invalidate,
    onError,
  });
  const pin = useMutation({
    mutationFn: (p: { messageId: string; isPinned: boolean }) =>
      api.setMessagePinned(p.messageId, user!.id, p.isPinned),
    onSuccess: invalidate,
    onError,
  });
  const deleteForMe = useMutation({
    mutationFn: (messageId: string) => api.hideMessageForUser(messageId, user!.id),
    onSuccess: invalidate,
    onError,
  });
  const deleteForAll = useMutation({
    mutationFn: (messageId: string) => api.deleteMessageForAll(messageId, user!.id),
    onSuccess: invalidate,
    onError,
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

export function useActiveQuizLiveSession() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const isOffline = useUIStore((s) => s.isOffline);
  return useQuery({
    queryKey: ['quizLiveSession', relationship?.id],
    queryFn: () => (relationship ? api.fetchActiveQuizLiveSession(relationship.id) : null),
    enabled: !!relationship?.id && !isOffline,
    refetchInterval: isOffline ? false : 4_000,
    retry: (count, error) => !isMissingTableError(error) && count < 1,
  });
}

export function useQuizLiveMutations() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['quizLiveSession', relationship?.id] });
  };

  const start = useMutation({
    mutationFn: (topic: string) => api.startQuizLiveSession(relationship!.id, user!.id, topic),
    onSuccess: invalidate,
  });

  const submitAnswer = useMutation({
    mutationFn: ({
      session,
      answerIndex,
      memberIds,
    }: {
      session: import('@/types/database').QuizLiveSession;
      answerIndex: number;
      memberIds: string[];
    }) => api.submitQuizLiveAnswer(session, user!.id, answerIndex, memberIds),
    onSuccess: invalidate,
  });

  const advance = useMutation({
    mutationFn: (session: import('@/types/database').QuizLiveSession) => api.advanceQuizLiveRound(session),
    onSuccess: invalidate,
  });

  const end = useMutation({
    mutationFn: (sessionId: string) => api.endQuizLiveSession(sessionId),
    onSuccess: invalidate,
  });

  return { start, submitAnswer, advance, end };
}
