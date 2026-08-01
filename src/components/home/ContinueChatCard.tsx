import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/primitives';
import { Radius } from '@/constants/design-system';
import { useLatestMessage, useUnreadMessageCount } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import {
  continueChatPreview,
  continueChatTitle,
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

  const visible = shouldShowContinueChat({
    hasPartner: !!partner,
    latest,
    unreadCount,
    currentUserId: user?.id,
  });

  const copy = useMemo(() => {
    if (!user?.id || !latest || !visible) return null;

    const fromPartner = latest.sender_id !== user.id;
    const minutesAgo = Math.max(
      0,
      Math.floor((Date.now() - new Date(latest.created_at).getTime()) / 60_000),
    );
    const partnerFirst = getFirstName(partner?.name) ?? 'Your partner';
    const unread = unreadCount > 0 && fromPartner;

    return {
      title: continueChatTitle({
        partnerFirst,
        fromPartner,
        unread,
        minutesAgo,
      }),
      preview: continueChatPreview(latest, user.id),
      ago: shortMessageAgo(latest.created_at),
      unread,
    };
  }, [latest, partner?.name, unreadCount, user?.id, visible]);

  if (!partner || !copy) return null;

  return (
    <Pressable
      onPress={() => openChat()}
      accessibilityRole="button"
      accessibilityLabel={`${copy.title}. ${copy.preview}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          shadowColor: colors.shadow,
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
        <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
          {copy.preview}
        </Text>
        {copy.unread ? (
          <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 12,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
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
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
});
