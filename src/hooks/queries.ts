import type { RealtimeChannel } from '@supabase/supabase-js';
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import type { MoodHistoryFilter } from '@/lib/mood-history';
import { resolveMoodFilterUserId as resolveMoodHistoryUserId } from '@/lib/mood-history';
import { getErrorMessage, isMissingTableError, toUserFacingNetworkError } from '@/lib/network-error';
import { filterInboxNotifications } from '@/lib/notification-display';
import { emptyStreakStatus } from '@/lib/streak';
import { getCachedStreakStatus, setCachedStreakStatus } from '@/lib/streak-cache';
import {
  getCachedDailyChallenge,
  setCachedDailyChallenge,
} from '@/lib/daily-challenge-cache';
import { localCalendarDate } from '@/lib/db-time';
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
const MESSAGES_STALE_MS = 5 * 60_000;
const HOME_STALE_MS = 5 * 60_000;
const HOME_GC_MS = 30 * 60_000;

export function streakQueryKey(relationshipId?: string) {
  return ['streak', relationshipId] as const;
}

export function moodsQueryKey(relationshipId?: string) {
  return ['moods', relationshipId] as const;
}

export function dailyChallengeQueryKey(relationshipId?: string, challengeDate?: string) {
  return ['daily-challenge', relationshipId, challengeDate ?? localCalendarDate()] as const;
}

export async function resolveDailyChallenge(relationshipId: string) {
  const challenge = await api.ensureDailyChallenge(relationshipId);
  await setCachedDailyChallenge(challenge);
  return challenge;
}

export async function warmDailyChallengeCache(
  queryClient: QueryClient,
  relationshipId: string,
) {
  const cached = await getCachedDailyChallenge(relationshipId);
  if (cached) {
    queryClient.setQueryData(dailyChallengeQueryKey(relationshipId), cached);
    void queryClient.prefetchQuery({
      queryKey: dailyChallengeQueryKey(relationshipId),
      queryFn: () => resolveDailyChallenge(relationshipId),
      staleTime: HOME_STALE_MS,
    });
    return;
  }
  await queryClient.prefetchQuery({
    queryKey: dailyChallengeQueryKey(relationshipId),
    queryFn: () => resolveDailyChallenge(relationshipId),
    staleTime: HOME_STALE_MS,
  });
}

export async function resolveStreakStatus(relationshipId: string) {
  const status = await api.fetchStreakStatus(relationshipId);
  const resolved = status ?? emptyStreakStatus(relationshipId);
  await setCachedStreakStatus(relationshipId, resolved);
  return resolved;
}

export async function warmStreakCache(
  queryClient: QueryClient,
  relationshipId: string,
) {
  const cached = await getCachedStreakStatus(relationshipId);
  if (cached) {
    queryClient.setQueryData(streakQueryKey(relationshipId), cached);
    // Refresh in the background; cached data is enough to paint home.
    void queryClient.prefetchQuery({
      queryKey: streakQueryKey(relationshipId),
      queryFn: () => resolveStreakStatus(relationshipId),
      staleTime: HOME_STALE_MS,
    });
    return;
  }
  await queryClient.prefetchQuery({
    queryKey: streakQueryKey(relationshipId),
    queryFn: () => resolveStreakStatus(relationshipId),
    staleTime: HOME_STALE_MS,
  });
}

export function messagesQueryKey(relationshipId?: string, userId?: string) {
  return ['messages', relationshipId, userId] as const;
}

export function applyMessagesReadInCache(
  queryClient: QueryClient,
  relationshipId: string,
  userId: string,
  readAt = new Date().toISOString(),
) {
  queryClient.setQueryData<InfiniteData<Message[]>>(
    messagesQueryKey(relationshipId, userId),
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) =>
          page.map((message) =>
            message.sender_id !== userId && !message.read_at
              ? { ...message, read_at: readAt }
              : message,
          ),
        ),
      };
    },
  );

  // Patch read receipt only — never refetch latestMessage (avoids resetting Continue Chat time).
  queryClient.setQueryData<Message | null>(
    ['latestMessage', relationshipId, userId],
    (old) => {
      if (!old || old.sender_id === userId || old.read_at) return old;
      return { ...old, read_at: readAt };
    },
  );

  queryClient.setQueryData(['unreadMessages', relationshipId, userId], 0);
}

/** Apply a single read receipt without touching created_at / Continue Chat preview time. */
function patchMessageReadReceipt(
  queryClient: QueryClient,
  relationshipId: string,
  userId: string,
  messageId: string,
  readAt: string,
) {
  queryClient.setQueryData<InfiniteData<Message[]>>(
    messagesQueryKey(relationshipId, userId),
    (old) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page) =>
          page.map((message) =>
            message.id === messageId ? { ...message, read_at: readAt } : message,
          ),
        ),
      };
    },
  );

  queryClient.setQueryData<Message | null>(
    ['latestMessage', relationshipId, userId],
    (old) => {
      if (!old || old.id !== messageId) return old;
      return { ...old, read_at: readAt };
    },
  );
}

export function useInfiniteMessages() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  const userId = user?.id;
  const relationshipId = relationship?.id;

  const query = useInfiniteQuery({
    queryKey: messagesQueryKey(relationshipId, userId),
    queryFn: ({ pageParam }) =>
      api.fetchMessages(relationshipId!, MESSAGES_PAGE_SIZE, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.length < MESSAGES_PAGE_SIZE ? undefined : lastPage[0]?.created_at,
    enabled: !!relationshipId && !!userId,
    staleTime: MESSAGES_STALE_MS,
    gcTime: 30 * 60_000,
    placeholderData: keepPreviousData,
  });

  const messages = useMemo(() => {
    if (!userId) return [];
    return (
      query.data?.pages.reduceRight<Message[]>((acc, page) => {
        const visible = page.filter((m) => !(m.hidden_for ?? []).includes(userId));
        return [...visible, ...acc];
      }, []) ?? []
    );
  }, [query.data?.pages, userId]);

  return { ...query, messages };
}

/** @deprecated use useInfiniteMessages — kept for callers that need a flat list */
export function useMessages() {
  const query = useInfiniteMessages();
  return { ...query, data: query.messages };
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

export function useLatestMessage() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: ['latestMessage', relationship?.id, user?.id],
    queryFn: () => api.fetchLatestMessage(relationship!.id, user!.id),
    enabled: !!relationship?.id && !!user?.id,
    staleTime: 20_000,
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
      queryClient.invalidateQueries({ queryKey: ['latestMessage', relationship?.id, user?.id] });
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

export function useMoods() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  return useQuery({
    queryKey: moodsQueryKey(relationship?.id),
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
    staleTime: HOME_STALE_MS,
    gcTime: HOME_GC_MS,
    placeholderData: keepPreviousData,
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
  const queryClient = useQueryClient();

  useEffect(() => {
    const id = relationship?.id;
    if (!id || queryClient.getQueryData(streakQueryKey(id))) return;
    void getCachedStreakStatus(id).then((cached) => {
      if (cached) {
        queryClient.setQueryData(streakQueryKey(id), cached);
      }
    });
  }, [relationship?.id, queryClient]);

  return useQuery({
    queryKey: streakQueryKey(relationship?.id),
    queryFn: () => resolveStreakStatus(relationship!.id),
    enabled: !!relationship?.id,
    staleTime: HOME_STALE_MS,
    gcTime: HOME_GC_MS,
    placeholderData: keepPreviousData,
    refetchInterval: 5 * 60_000,
  });
}

export function useDailyChallenge() {
  const relationship = useRelationshipStore((s) => s.relationship);
  const queryClient = useQueryClient();
  const [today, setToday] = useState(localCalendarDate);

  // Roll to a new query when the device local date changes (midnight).
  useEffect(() => {
    const id = setInterval(() => {
      const next = localCalendarDate();
      setToday((prev) => (prev === next ? prev : next));
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = relationship?.id;
    if (!id || queryClient.getQueryData(dailyChallengeQueryKey(id, today))) return;
    void getCachedDailyChallenge(id, today).then((cached) => {
      if (cached) {
        queryClient.setQueryData(dailyChallengeQueryKey(id, today), cached);
      }
    });
  }, [relationship?.id, queryClient, today]);

  return useQuery({
    queryKey: dailyChallengeQueryKey(relationship?.id, today),
    queryFn: () => resolveDailyChallenge(relationship!.id),
    enabled: !!relationship?.id,
    staleTime: HOME_STALE_MS,
    gcTime: HOME_GC_MS,
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
}

export function useDailyChallengeHistory() {
  const relationship = useRelationshipStore((s) => s.relationship);
  return useQuery({
    queryKey: ['daily-challenge-history', relationship?.id],
    queryFn: () => api.fetchDailyChallengeHistory(relationship!.id),
    enabled: !!relationship?.id,
    staleTime: 60_000,
  });
}

export function useRespondToDailyChallenge() {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: ({ challengeId, response }: { challengeId: string; response: string }) => {
      if (!user?.id || !relationship) {
        throw new Error('You need to be signed in with an active relationship.');
      }
      return api.respondToDailyChallenge(
        challengeId,
        user.id,
        relationship,
        response,
        user.name,
      );
    },
    onSuccess: (data) => {
      void setCachedDailyChallenge(data);
      queryClient.setQueryData(
        dailyChallengeQueryKey(relationship?.id, data.challenge_date),
        data,
      );
      queryClient.setQueryData(
        ['daily-challenge-history', relationship?.id],
        (prev: unknown) => {
          if (!Array.isArray(prev)) return prev;
          const list = prev as { id: string }[];
          const idx = list.findIndex((row) => row.id === data.id);
          if (idx === -1) return [data, ...list];
          const next = list.slice();
          next[idx] = data;
          return next;
        },
      );
      // Don't await — refetch must not keep the submit button spinning.
      void queryClient.invalidateQueries({ queryKey: ['daily-challenge', relationship?.id] });
      void queryClient.invalidateQueries({ queryKey: ['daily-challenge-history', relationship?.id] });
      void queryClient.invalidateQueries({ queryKey: ['streak', relationship?.id] });
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({ queryKey: ['notificationUnreadCount'] });
    },
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
  const data = useMemo(
    () => filterInboxNotifications(feed.data?.pages.flat() ?? []),
    [feed.data],
  );
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
let messageInvalidateTimer: ReturnType<typeof setTimeout> | null = null;

function debouncedInvalidateMessageQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  relationshipId: string,
  userId?: string,
  eventType?: string,
) {
  if (messageInvalidateTimer) clearTimeout(messageInvalidateTimer);
  messageInvalidateTimer = setTimeout(() => {
    messageInvalidateTimer = null;
    queryClient.invalidateQueries({ queryKey: ['messages', relationshipId] });
    if (!userId) return;

    if (eventType === 'READ_RECEIPT') {
      // Badge + Continue Chat time already patched — skip refetch races.
      return;
    }

    queryClient.invalidateQueries({ queryKey: ['unreadMessages', relationshipId, userId] });
    queryClient.invalidateQueries({ queryKey: ['latestMessage', relationshipId, userId] });
  }, 400);
}

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
    | 'streaks'
    | 'daily_challenges',
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
        (payload) => {
          const qc = queryClientRef.current;
          qc.invalidateQueries({ queryKey: [table === 'mood_logs' ? 'moods' : table.replace('_logs', ''), relationship.id] });
          if (table === 'messages') {
            const userId = useAuthStore.getState().user?.id;
            const eventType =
              payload && typeof payload === 'object' && 'eventType' in payload
                ? String((payload as { eventType?: string }).eventType)
                : undefined;
            const row =
              payload && typeof payload === 'object' && 'new' in payload
                ? ((payload as { new?: Partial<Message> }).new ?? undefined)
                : undefined;

            // Read receipts: patch read_at in place — do not refetch latestMessage (keeps send time).
            const isReadReceipt =
              eventType === 'UPDATE' && !!row?.id && !!row.read_at && !row.deleted_for_all;

            if (isReadReceipt && userId && row.id && row.read_at) {
              patchMessageReadReceipt(qc, relationship.id, userId, row.id, row.read_at);
            }

            debouncedInvalidateMessageQueries(
              qc,
              relationship.id,
              userId,
              isReadReceipt ? 'READ_RECEIPT' : eventType,
            );
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
          if (table === 'daily_challenges') {
            qc.invalidateQueries({ queryKey: ['daily-challenge', relationship.id] });
            qc.invalidateQueries({ queryKey: ['daily-challenge-history', relationship.id] });
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
