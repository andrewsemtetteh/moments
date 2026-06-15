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

interface MomentsWallProps {
  moments: Moment[];
}

const TILE_W = (Dimensions.get('window').width - 16 * 2 - 10) / 2 - 4;

export function MomentsWall({ moments }: MomentsWallProps) {
  const openMomentViewer = useUIStore((s) => s.openMomentViewer);

  return (
    <View style={styles.grid}>
      {moments.map((moment, i) => (
        <WallTile
          key={moment.id}
          moment={moment}
          tilt={i % 3 === 1 ? -2 : i % 3 === 2 ? 1.5 : 0}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            openMomentViewer(moments, i, { playback: 'focus' });
          }}
        />
      ))}
    </View>
  );
}

function WallTile({
  moment,
  tilt,
  onPress,
}: {
  moment: Moment;
  tilt: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const reactMutation = useMomentReaction();
  const isMine = moment.user_id === user?.id;
  const iLiked = (moment.reactions?.['❤️'] ?? []).includes(user?.id ?? '');

  const like = () => {
    if (moment.id.startsWith('temp-')) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reactMutation.mutate({ momentId: moment.id, emoji: '❤️' });
  };

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        { transform: [{ rotate: `${tilt}deg` }] },
        pressed && { opacity: 0.9, transform: [{ rotate: `${tilt}deg` }, { scale: 0.97 }] },
      ]}>
      <View style={styles.blobWrap}>
        <WallMedia moment={moment} />
        <Pressable onPress={like} style={styles.heartFab} hitSlop={8}>
          <Icon name="heart" size={14} color={iLiked ? '#FF3040' : '#fff'} filled={iLiked} />
        </Pressable>
      </View>
      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
        {isMine ? 'You' : moment.author?.name?.split(' ')[0] ?? 'Partner'}
      </Text>
      <Text style={[styles.meta, { color: colors.textTertiary }]} numberOfLines={1}>
        {momentPreviewLabel(moment)} · {formatDistanceToNow(new Date(moment.created_at), { addSuffix: true })}
      </Text>
    </Pressable>
  );
}

function WallMedia({ moment }: { moment: Moment }) {
  const { colors } = useTheme();

  if (moment.type === 'video' && moment.media_url) {
    return (
      <View style={{ width: TILE_W, height: TILE_W * 1.12, borderRadius: 18, overflow: 'hidden' }}>
        <MomentVideoPlayer uri={moment.media_url} fill />
        <View style={styles.videoBadge}>
          <Icon name="videocam" size={12} color="#fff" />
        </View>
      </View>
    );
  }

  if (moment.type === 'photo' && moment.media_url) {
    return <MomentBlobFrame width={TILE_W} imageUri={moment.media_url} />;
  }

  return (
    <MomentBlobFrame width={TILE_W} fill={colors.accent + 'CC'}>
      <Icon name="heart" size={28} color="#fff" filled />
    </MomentBlobFrame>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  tile: { width: '48%', marginBottom: 8 },
  blobWrap: { position: 'relative', alignItems: 'center' },
  heartFab: {
    position: 'absolute',
    bottom: 6,
    right: 4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 13, fontWeight: '800', marginTop: 6 },
  meta: { fontSize: 11, marginTop: 2, fontWeight: '500' },
});
