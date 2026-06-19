import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { resolveMomentForReply } from '@/lib/moment-reply';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type { Message } from '@/types/database';

interface MomentReplyCardProps {
  message: Message;
  isSelf: boolean;
}

export function MomentReplyCard({ message, isSelf }: MomentReplyCardProps) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const openMomentViewer = useUIStore((s) => s.openMomentViewer);

  const momentId = message.moment_id;
  const previewUrl = message.media_url;
  const isVideo = message.media_type === 'video';

  if (!momentId) return null;

  const openPreview = async () => {
    const moment = await resolveMomentForReply(momentId, user, partner);
    if (!moment) return;
    openMomentViewer([moment], 0, { playback: 'focus', sectionLabel: 'From chat' });
  };

  const borderColor = isSelf ? 'rgba(255,255,255,0.2)' : colors.border;

  return (
    <Pressable
      onPress={() => void openPreview()}
      style={[styles.card, { borderColor, backgroundColor: isSelf ? 'rgba(0,0,0,0.15)' : colors.surfaceElevated }]}
      accessibilityLabel="Open moment">
      <View style={styles.thumbWrap}>
        {previewUrl ? (
          <Image source={{ uri: previewUrl }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder, { backgroundColor: colors.surface }]}>
            <ActivityIndicator size="small" color={colors.textTertiary} />
          </View>
        )}
        {isVideo && (
          <View style={styles.playBadge}>
            <Icon name="play" size={14} color="#fff" filled />
          </View>
        )}
      </View>
      <View style={styles.meta}>
        <Text style={[styles.label, { color: isSelf ? 'rgba(255,255,255,0.85)' : colors.textSecondary }]}>
          Replied to moment
        </Text>
        <Text style={[styles.hint, { color: isSelf ? 'rgba(255,255,255,0.55)' : colors.textTertiary }]}>
          Tap to preview
        </Text>
      </View>
      <Icon name="chevronRight" size={16} color={isSelf ? 'rgba(255,255,255,0.45)' : colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 6,
  },
  thumbWrap: { position: 'relative' },
  thumb: { width: 52, height: 52, borderRadius: 10 },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  playBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, gap: 2 },
  label: { fontSize: 12, fontWeight: '800' },
  hint: { fontSize: 11, fontWeight: '600' },
});
