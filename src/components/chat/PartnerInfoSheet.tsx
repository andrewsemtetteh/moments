import { PartnerStatusLine } from '@/components/chat/PartnerStatusLine';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { useRelationshipStore } from '@/stores';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
  visible: boolean;
  partnerTyping: boolean;
  partnerOnline: boolean;
  partnerLastSeenAt: string | null;
  onClose: () => void;
  onSendMessage: () => void;
  onViewAvatar?: () => void;
  onViewProfile?: () => void;
  onViewMoments?: () => void;
}

export function PartnerInfoSheet({
  visible,
  partnerTyping,
  partnerOnline,
  partnerLastSeenAt,
  onClose,
  onSendMessage,
  onViewAvatar,
  onViewProfile,
  onViewMoments,
}: Props) {
  const { colors } = useTheme();
  const partner = useRelationshipStore((s) => s.partner);
  const relationship = useRelationshipStore((s) => s.relationship);

  const since = relationship?.created_at
    ? new Date(relationship.created_at).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <View
          style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]}
          onStartShouldSetResponder={() => true}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <Pressable
            style={styles.avatarRow}
            onPress={onViewAvatar}
            disabled={!partner?.avatar_url}
            accessibilityRole="button"
            accessibilityLabel="View profile photo">
            <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={72} />
          </Pressable>

          <Text style={[styles.name, { color: colors.text }]}>{partner?.name ?? 'Partner'}</Text>

          <View style={[styles.statusPill, { backgroundColor: colors.accentSoft }]}>
            <PartnerStatusLine
              isTyping={partnerTyping}
              isOnline={partnerOnline}
              lastSeenAt={partnerLastSeenAt}
              textStyle={styles.statusText}
            />
          </View>

          {since && (
            <Text style={[styles.since, { color: colors.textSecondary }]}>
              Together since {since}
            </Text>
          )}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <View style={styles.actions}>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => { onClose(); onSendMessage(); }}>
              <Icon name="chat" size={22} color={colors.accent} />
              <Text style={[styles.actionLabel, { color: colors.text }]}>Message</Text>
            </Pressable>

            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => { onClose(); onViewMoments?.(); }}>
              <Icon name="camera" size={22} color={colors.accent} />
              <Text style={[styles.actionLabel, { color: colors.text }]}>Moments</Text>
            </Pressable>

            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => { onClose(); onViewProfile?.(); }}>
              <Icon name="heart" size={22} color={colors.accent} />
              <Text style={[styles.actionLabel, { color: colors.text }]}>Profile</Text>
            </Pressable>
          </View>

          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={[styles.closeTxt, { color: colors.textSecondary }]}>Close</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  avatarRow: { marginBottom: 14 },
  name: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, marginBottom: 8 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 8,
  },
  statusText: { fontSize: 13, fontWeight: '600' },
  since: { fontSize: 13, marginBottom: 20 },
  divider: { width: '100%', height: StyleSheet.hairlineWidth, marginBottom: 20 },
  actions: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: { fontSize: 12, fontWeight: '600' },
  closeBtn: { paddingVertical: 8 },
  closeTxt: { fontSize: 15, fontWeight: '600' },
});
