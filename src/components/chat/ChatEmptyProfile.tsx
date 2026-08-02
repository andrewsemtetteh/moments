import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PartnerStatusLine } from '@/components/chat/PartnerStatusLine';
import { FullScreenImageModal } from '@/components/ui/FullScreenImageModal';
import { Avatar } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { formatPartnerStatus } from '@/lib/partner-status';
import type { Relationship, UserProfile } from '@/types/database';

export type ChatEmptyProfileProps = {
  partner: UserProfile | null;
  relationship: Relationship | null;
  isTyping: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
  statusHidden?: boolean;
  onOpenProfile: () => void;
  onOpenAvatar?: () => void;
};

export function ChatEmptyProfile({
  partner,
  relationship,
  isTyping,
  isOnline,
  lastSeenAt,
  statusHidden = false,
  onOpenProfile,
  onOpenAvatar,
}: ChatEmptyProfileProps) {
  const { colors } = useTheme();
  const [showPhoto, setShowPhoto] = useState(false);
  const status = formatPartnerStatus(isTyping, isOnline, lastSeenAt, statusHidden);

  const since = relationship?.created_at
    ? new Date(relationship.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <View style={styles.container}>
      <Pressable
        onPress={onOpenAvatar ?? onOpenProfile}
        onLongPress={() => setShowPhoto(true)}
        delayLongPress={400}
        accessibilityRole="button"
        accessibilityLabel="View partner profile">
        <View style={styles.avatarWrap}>
          <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={108} />
          {status.variant === 'online' && (
            <View style={[styles.onlineRing, { borderColor: colors.background, backgroundColor: colors.success }]} />
          )}
        </View>
      </Pressable>

      <Pressable onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel="View partner profile">
        <Text style={[styles.name, { color: colors.text }]}>{partner?.name ?? 'Partner'}</Text>
      </Pressable>

      <PartnerStatusLine
        isTyping={isTyping}
        isOnline={isOnline}
        lastSeenAt={lastSeenAt}
        statusHidden={statusHidden}
        style={styles.status}
        textStyle={{ fontSize: 14, fontWeight: '600' }}
      />

      {since && (
        <Text style={[styles.since, { color: colors.textSecondary }]}>Together since {since}</Text>
      )}

      <View style={[styles.divider, { backgroundColor: colors.border }]} />

      <Text style={[styles.note, { color: colors.textSecondary }]}>
        This is the start of your private space. Say hello. Only you two can see messages here.
      </Text>

      <Pressable onPress={onOpenProfile} style={[styles.profileBtn, { borderColor: colors.border }]}>
        <Text style={[styles.profileBtnText, { color: colors.accent }]}>View profile</Text>
      </Pressable>

      <FullScreenImageModal
        visible={showPhoto}
        imageUrl={partner?.avatar_url}
        fallbackName={partner?.name}
        title={partner?.name ?? 'Partner'}
        onClose={() => setShowPhoto(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
    paddingBottom: 24,
    gap: 10,
  },
  avatarWrap: { marginBottom: 4 },
  onlineRing: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
  },
  status: { marginTop: 2 },
  since: { fontSize: 13, marginTop: 2 },
  divider: {
    width: 48,
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
  },
  note: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    maxWidth: 300,
  },
  profileBtn: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  profileBtnText: { fontSize: 14, fontWeight: '700' },
});
