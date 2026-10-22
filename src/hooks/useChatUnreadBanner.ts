import { useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type ViewToken } from 'react-native';

import { applyMessagesReadInCache } from '@/hooks/queries';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { Message } from '@/types/database';

/** How long the divider stays once it's on screen (it waits for you to see it first). */
const BANNER_AUTO_DISMISS_MS = 4000;
const VIEWABILITY_CONFIG = { itemVisiblePercentThreshold: 10, minimumViewTime: 80 };

/**
 * Unread chat banner + header badge:
 * - Accurate unread count on open (server count)
 * - Messages are only marked read — and the badge cleared — once the unread divider has
 *   actually scrolled into view, the same way WhatsApp/iMessage wait for the message to be
 *   seen rather than clearing read state the instant the thread mounts.
 * - Banner dismisses after a few seconds once seen, when typing, or when scrolled past
 * - Messages that arrive while you're looking at the chat (screen focused, app in the
 *   foreground) are read straight away, like every chat app: your partner sees them
 *   as read and the Chat badge doesn't count them. Ones that arrive while the app is
 *   in the background are read when you come back to it.
 */
export function useChatUnreadBanner(
  messages: Message[] | undefined,
  /** The thread's messages are fresh from the server (or the fetch is over): safe to snapshot. */
  settled = true,
) {
  const queryClient = useQueryClient();
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const userId = useAuthStore((s) => s.user?.id);

  const [unreadBannerIds, setUnreadBannerIds] = useState<Set<string> | null>(null);
  const [unreadBannerCount, setUnreadBannerCount] = useState(0);
  const dismissedRef = useRef(false);
  const bannerSeenRef = useRef(false);
  const markedReadRef = useRef(false);

  // Only read things the person can actually see: this screen in front, app in the foreground.
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => setAppActive(state === 'active'));
    return () => sub.remove();
  }, []);

  // Reset when switching conversations (adjusted while rendering, not in an effect).
  const [bannerFor, setBannerFor] = useState(relationshipId);
  if (bannerFor !== relationshipId) {
    setBannerFor(relationshipId);
    setUnreadBannerIds(null);
    setUnreadBannerCount(0);
  }
  useEffect(() => {
    dismissedRef.current = false;
    bannerSeenRef.current = false;
    markedReadRef.current = false;
  }, [relationshipId]);

  const clearBadge = useCallback(() => {
    if (!relationshipId || !userId) return;
    const key = ['unreadMessages', relationshipId, userId] as const;
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData(key, 0);
  }, [queryClient, relationshipId, userId]);

  const markReadAndClearBadge = useCallback(() => {
    if (!relationshipId || !userId || markedReadRef.current) return;
    markedReadRef.current = true;
    clearBadge();
    void api
      .markMessagesRead(relationshipId, userId)
      .then(() => {
        applyMessagesReadInCache(queryClient, relationshipId, userId);
        clearBadge();
      })
      .catch(() => {
        // Allow a retry on the next open if the server mark failed.
        markedReadRef.current = false;
        void queryClient.invalidateQueries({
          queryKey: ['unreadMessages', relationshipId, userId],
        });
      });
  }, [clearBadge, queryClient, relationshipId, userId]);

  const dismissUnreadBanner = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setUnreadBannerIds(new Set());
    setUnreadBannerCount(0);
    markReadAndClearBadge();
  }, [markReadAndClearBadge]);

  // The latest versions, for the list's visibility callback (kept in sync after each render).
  const dismissRef = useRef(dismissUnreadBanner);
  const markReadRef = useRef(markReadAndClearBadge);
  useEffect(() => {
    dismissRef.current = dismissUnreadBanner;
    markReadRef.current = markReadAndClearBadge;
  }, [dismissUnreadBanner, markReadAndClearBadge]);

  // Snapshot unread messages once when the thread loads (taken while rendering)… but only from
  // the fresh copy: the one kept from last time may not have the newest messages yet, and those
  // were then taken for "just arrived while looking" and read at once, so no divider showed.
  if (messages && userId && unreadBannerIds === null && settled) {
    const unread = new Set(messages.filter((m) => m.sender_id !== userId && !m.read_at).map((m) => m.id));
    setUnreadBannerIds(unread);
    setUnreadBannerCount(unread.size);
  }

  // …then its side effects: clear a stale badge, or fetch the full unread count.
  useEffect(() => {
    if (!unreadBannerIds || !userId) return;
    if (unreadBannerIds.size === 0 || !relationshipId) {
      // Thread has nothing unread — force-clear a stale header badge.
      clearBadge();
      return;
    }
    dismissedRef.current = false;
    bannerSeenRef.current = false;
    markedReadRef.current = false;
    const shown = unreadBannerIds.size;
    let cancelled = false;
    // Prefer the full server count (not just currently loaded pages).
    void api.fetchUnreadMessageCount(relationshipId, userId).then((count) => {
      if (cancelled || dismissedRef.current) return;
      setUnreadBannerCount(Math.max(count, shown));
    });
    return () => {
      cancelled = true;
    };
    // Once per snapshot: unreadBannerIds is only replaced when it's taken or dismissed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadBannerIds]);

  // New messages from your partner after the thread opened (not the ones the unread divider
  // is waiting on): read as soon as they're on screen.
  useEffect(() => {
    if (!messages || !userId || !relationshipId || unreadBannerIds === null) return;
    if (!focused || !appActive) return;
    const fresh = messages.some(
      (m) => m.sender_id !== userId && !m.read_at && !m.deleted_for_all && !unreadBannerIds.has(m.id),
    );
    if (!fresh) return;
    const timer = setTimeout(() => {
      clearBadge();
      void api
        .markMessagesRead(relationshipId, userId)
        .then(() => {
          applyMessagesReadInCache(queryClient, relationshipId, userId);
          clearBadge();
        })
        .catch(() => {
          void queryClient.invalidateQueries({ queryKey: ['unreadMessages', relationshipId, userId] });
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [messages, userId, relationshipId, unreadBannerIds, focused, appActive, clearBadge, queryClient]);

  // Auto-dismiss the "N UNREAD" label a few seconds after it has actually been seen (the
  // timer starts in the visibility callback below, not when the thread opens).
  const autoDismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (autoDismissRef.current) clearTimeout(autoDismissRef.current);
    },
    [],
  );

  const onComposerActivity = useCallback(() => {
    if (unreadBannerIds && unreadBannerIds.size > 0) {
      dismissRef.current();
    }
  }, [unreadBannerIds]);

  // Made once (FlatList needs it to never change); it reads the latest state through refs.
  const [onViewableItemsChanged] = useState(
    () => ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (dismissedRef.current) return;
      const dividerVisible = viewableItems.some(
        (token) =>
          token.item &&
          typeof token.item === 'object' &&
          'type' in token.item &&
          (token.item as { type?: string }).type === 'unread',
      );

      if (dividerVisible) {
        if (!bannerSeenRef.current) {
          autoDismissRef.current = setTimeout(() => dismissRef.current(), BANNER_AUTO_DISMISS_MS);
        }
        bannerSeenRef.current = true;
        // The unread messages have actually been seen on screen now — safe to mark read.
        markReadRef.current();
        return;
      }

      // Scrolled so the unread marker is above / off-screen.
      if (bannerSeenRef.current) {
        dismissRef.current();
      }
    },
  );
  const viewabilityConfig = VIEWABILITY_CONFIG;

  return {
    unreadBannerIds,
    unreadBannerCount,
    dismissUnreadBanner,
    onComposerActivity,
    onViewableItemsChanged,
    viewabilityConfig,
  };
}
