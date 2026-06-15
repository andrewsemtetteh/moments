import { LinearGradient } from 'expo-linear-gradient';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';

import { MomentBlobFrame } from '@/components/moments/MomentBlobFrame';
import { MomentVideoPlayer } from '@/components/moments/MomentVideoPlayer';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { useMomentReaction } from '@/hooks/queries';
import { momentPreviewLabel } from '@/lib/moment-display';
import { useAuthStore, useUIStore } from '@/stores';
import type { Moment } from '@/types/database';

const PREVIEW_W = Math.min(Dimensions.get('window').width - 64, 280);

interface MomentCardProps {
  moment: Moment;
  onPress?: () => void;
}

export function MomentCard({ moment, onPress }: MomentCardProps) {
  const openMomentViewer = useUIStore((s) => s.openMomentViewer);
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const reactMutation = useMomentReaction();
  const iLiked = (moment.reactions?.['❤️'] ?? []).includes(user?.id ?? '');

  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    openMomentViewer([moment], 0, { playback: 'focus' });
  };

  const like = () => {
    if (moment.id.startsWith('temp-')) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reactMutation.mutate({ momentId: moment.id, emoji: '❤️' });
  };

  return (
    <Pressable onPress={handlePress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <LinearGradient colors={['#111', '#000']} style={styles.inner}>
        <View style={styles.blobCenter}>
          <MomentPreview moment={moment} />
        </View>

        <View style={styles.footer}>
          <View style={{ flex: 1 }}>
            <Text style={styles.author}>{moment.author?.name ?? 'Partner'}</Text>
            <Text style={styles.caption}>{momentPreviewLabel(moment)}</Text>
            <Text style={styles.time}>{formatDistanceToNow(new Date(moment.created_at), { addSuffix: true })}</Text>
          </View>
          <Pressable onPress={like} hitSlop={10}>
            <Icon name="heart" size={22} color={iLiked ? colors.accent : 'rgba(255,255,255,0.7)'} filled={iLiked} />
          </Pressable>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

function MomentPreview({ moment }: { moment: Moment }) {
  const { colors } = useTheme();

  if (moment.type === 'video' && moment.media_url) {
    return (
      <View style={{ width: PREVIEW_W, height: PREVIEW_W * 1.12, borderRadius: 20, overflow: 'hidden' }}>
        <MomentVideoPlayer uri={moment.media_url} fill />
        <View style={styles.playBadge}>
          <Icon name="videocam" size={16} color="#fff" />
        </View>
      </View>
    );
  }

  if (moment.type === 'photo' && moment.media_url) {
    return <MomentBlobFrame width={PREVIEW_W} imageUri={moment.media_url} />;
  }

  return (
    <MomentBlobFrame width={PREVIEW_W} fill={colors.accent + 'AA'}>
      <Icon name="heart" size={36} color="#fff" filled />
    </MomentBlobFrame>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14, borderRadius: 24, overflow: 'hidden' },
  inner: { paddingVertical: 24, paddingHorizontal: 16, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.08)' },
  blobCenter: { alignItems: 'center', marginBottom: 16 },
  footer: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingHorizontal: 4 },
  author: { color: '#fff', fontWeight: '800', fontSize: 14 },
  caption: { color: 'rgba(255,255,255,0.85)', fontSize: 14, marginTop: 4 },
  time: { color: 'rgba(255,255,255,0.45)', fontSize: 11, marginTop: 4, fontWeight: '600' },
  playBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.94 },
});
