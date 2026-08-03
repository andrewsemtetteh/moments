import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/primitives';
import { Radius } from '@/constants/design-system';
import { useLatestMessage, useUnreadMessageCount } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import {
  continueChatPreview,
  continueChatTitle,
  messageTimestampMs,
  shortMessageAgo,
  shouldShowContinueChat,
} from '@/lib/continue-chat';
import { openChat } from '@/lib/router';
import { useAuthStore, useRelationshipStore } from '@/stores';

/** Intimate home shortcut back into the shared conversation. */
export function ContinueChatCard() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const { data: latest } = useLatestMessage();
  const { data: unreadCount = 0 } = useUnreadMessageCount();
  const [now, setNow] = useState(() => Date.now());

  // Keep relative time fresh while the home tab is open.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const visible = shouldShowContinueChat({
    hasPartner: !!partner,
    latest,
    unreadCount,
    currentUserId: user?.id,
    now: new Date(now),
  });

  const copy = useMemo(() => {
    if (!user?.id || !latest || !visible) return null;

    const fromPartner = latest.sender_id !== user.id;
    const ref = new Date(now);
    // Always use send time (created_at) — never read_at.
    const sentAt = messageTimestampMs(latest.created_at);
    const minutesAgo = Number.isNaN(sentAt)
      ? 0
      : Math.max(0, Math.floor((ref.getTime() - sentAt) / 60_000));
    const partnerFirst = getFirstName(partner?.name) ?? 'Your partner';
    const unread = unreadCount > 0 && fromPartner;

    return {
      title: continueChatTitle({
        partnerFirst,
        fromPartner,
        unread,
        minutesAgo,
      }),
      preview: continueChatPreview(latest, user.id, partnerFirst),
      ago: shortMessageAgo(latest.created_at, ref),
    };
  }, [latest, partner?.name, unreadCount, user?.id, visible, now]);

  if (!partner || !copy) return null;

  return (
    <Pressable
      onPress={() => openChat()}
      accessibilityRole="button"
      accessibilityLabel={`${copy.title}. ${copy.preview}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}>
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {copy.title}
        </Text>
        {copy.ago ? (
          <Text style={[styles.ago, { color: colors.textTertiary }]}>{copy.ago}</Text>
        ) : null}
      </View>

      <View style={styles.bottomRow}>
        <Avatar name={partner.name} imageUrl={partner.avatar_url} size={36} />
        <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={2}>
          {copy.preview}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  ago: {
    fontSize: 13,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  preview: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 19,
  },
});
