import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LocationMapPreview } from '@/components/moments/LocationMapPreview';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useLatestMessage, useUnreadMessageCount } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { formatBadgeCount } from '@/lib/format-badge';
import {
  continueChatAttachment,
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
      attachment: continueChatAttachment(latest),
    };
  }, [latest, partner?.name, unreadCount, user?.id, visible, now]);

  if (!partner || !copy) return null;

  const { attachment } = copy;

  const unread = unreadCount > 0;

  // A slim row, like a chat list entry: their photo (with the unread count),
  // their name and when, and the last message.
  return (
    <Pressable
      onPress={() => openChat()}
      accessibilityRole="button"
      accessibilityLabel={`${copy.title}. ${copy.preview}`}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.surface }, pressed && styles.pressed]}>
      <View>
        {attachment?.type === 'location' ? (
          <LocationMapPreview
            markers={[{ latitude: attachment.latitude, longitude: attachment.longitude, color: colors.accent }]}
            height={44}
            style={styles.attachmentThumb}
          />
        ) : attachment?.type === 'contact' ? (
          <View style={[styles.contactThumb, { backgroundColor: colors.accentSoft }]}>
            <Text style={[styles.contactThumbText, { color: colors.accent }]}>
              {attachment.name.trim().charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        ) : (
          <Avatar name={partner.name} imageUrl={partner.avatar_url} size={44} />
        )}
        {unread ? (
          <View style={[styles.badge, { borderColor: colors.surface, backgroundColor: colors.error }]}>
            <Text style={styles.badgeText}>{formatBadgeCount(unreadCount)}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {getFirstName(partner.name) ?? copy.title}
          </Text>
          {copy.ago ? <Text style={[styles.ago, { color: colors.textTertiary }]}>{copy.ago}</Text> : null}
        </View>
        <Text
          style={[styles.preview, { color: unread ? colors.text : colors.textSecondary, fontWeight: unread ? '700' : '500' }]}
          numberOfLines={1}>
          {copy.preview}
        </Text>
      </View>
      <Icon name="chevronRight" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pressed: { opacity: 0.85 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  topRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '800' },
  ago: { fontSize: 12, fontWeight: '600' },
  preview: { fontSize: 14 },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  attachmentThumb: { width: 44, borderRadius: 12 },
  contactThumb: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  contactThumbText: { fontSize: 16, fontWeight: '800' },
});
