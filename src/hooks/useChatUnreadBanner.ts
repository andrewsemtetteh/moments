import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ViewToken } from 'react-native';

import { applyMessagesReadInCache } from '@/hooks/queries';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { Message } from '@/types/database';

const BANNER_AUTO_DISMISS_MS = 3000;

/**
 * Unread chat banner + header badge:
 * - Accurate unread count on open (server count, badge cleared immediately)
 * - Banner dismisses after a few seconds, when typing, or when scrolled past
 */
export function useChatUnreadBanner(messages: Message[] | undefined) {
  const queryClient = useQueryClient();
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);

  const [unreadBannerIds, setUnreadBannerIds] = useState<Set<string> | null>(null);
  const [unreadBannerCount, setUnreadBannerCount] = useState(0);
  const dismissedRef = useRef(false);
  const bannerSeenRef = useRef(false);
  const markedReadRef = useRef(false);

  // Reset when switching conversations.
  useEffect(() => {
    setUnreadBannerIds(null);
    setUnreadBannerCount(0);
    dismissedRef.current = false;
    bannerSeenRef.current = false;
    markedReadRef.current = false;
  }, [relationship?.id]);

  const clearBadge = useCallback(() => {
    if (!relationship?.id || !user?.id) return;
    const key = ['unreadMessages', relationship.id, user.id] as const;
    void queryClient.cancelQueries({ queryKey: key });
    queryClient.setQueryData(key, 0);
  }, [queryClient, relationship?.id, user?.id]);

  const markReadAndClearBadge = useCallback(() => {
    if (!relationship?.id || !user?.id || markedReadRef.current) return;
    markedReadRef.current = true;
    clearBadge();
    void api
      .markMessagesRead(relationship.id, user.id)
      .then(() => {
        applyMessagesReadInCache(queryClient, relationship.id, user.id);
        clearBadge();
      })
      .catch(() => {
        // Allow a retry on the next open if the server mark failed.
        markedReadRef.current = false;
        void queryClient.invalidateQueries({
          queryKey: ['unreadMessages', relationship.id, user.id],
        });
      });
  }, [clearBadge, queryClient, relationship?.id, user?.id]);

  const dismissUnreadBanner = useCallback(() => {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setUnreadBannerIds(new Set());
    setUnreadBannerCount(0);
    markReadAndClearBadge();
  }, [markReadAndClearBadge]);

  const dismissRef = useRef(dismissUnreadBanner);
  dismissRef.current = dismissUnreadBanner;

  // Snapshot unread messages once when the thread loads.
  useEffect(() => {
    if (!messages || !user || unreadBannerIds !== null) return;

    const unread = new Set(
      messages.filter((m) => m.sender_id !== user.id && !m.read_at).map((m) => m.id),
    );
    setUnreadBannerIds(unread);

    if (unread.size === 0 || !relationship?.id) {
      setUnreadBannerCount(0);
      // Thread has nothing unread — force-clear a stale header badge.
      clearBadge();
      return;
    }

    dismissedRef.current = false;
    bannerSeenRef.current = false;
    markedReadRef.current = false;

    // Prefer the full server count (not just currently loaded pages).
    void api.fetchUnreadMessageCount(relationship.id, user.id).then((count) => {
      if (dismissedRef.current) return;
      setUnreadBannerCount(Math.max(count, unread.size));
    });
    setUnreadBannerCount(unread.size);

    // Fix header badge as soon as chat opens.
    markReadAndClearBadge();
  }, [messages, user, relationship?.id, unreadBannerIds, markReadAndClearBadge, clearBadge]);

  // Auto-dismiss the "N UNREAD" label after a few seconds.
  useEffect(() => {
    if (!unreadBannerIds || unreadBannerIds.size === 0) return;
    const timer = setTimeout(() => dismissRef.current(), BANNER_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [unreadBannerIds]);

  const onComposerActivity = useCallback(() => {
    if (unreadBannerIds && unreadBannerIds.size > 0) {
      dismissRef.current();
    }
  }, [unreadBannerIds]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (dismissedRef.current) return;
      const dividerVisible = viewableItems.some(
        (token) =>
          token.item &&
          typeof token.item === 'object' &&
          'type' in token.item &&
          (token.item as { type?: string }).type === 'unread',
      );

      if (dividerVisible) {
        bannerSeenRef.current = true;
        return;
      }

      // Scrolled so the unread marker is above / off-screen.
      if (bannerSeenRef.current) {
        dismissRef.current();
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 10,
    minimumViewTime: 80,
  }).current;

  return {
    unreadBannerIds,
    unreadBannerCount,
    dismissUnreadBanner,
    onComposerActivity,
    onViewableItemsChanged,
    viewabilityConfig,
  };
}
