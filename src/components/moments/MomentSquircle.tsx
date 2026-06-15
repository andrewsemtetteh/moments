import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { MomentVideoPlayer } from '@/components/moments/MomentVideoPlayer';
import type { Moment } from '@/types/database';

interface MomentSquircleProps {
  moment: Moment;
  size: number;
  onPress?: () => void;
  /** Counter-party reaction — notification badge top-right */
  reactionBadge?: { emoji: string; count: number } | null;
}

export function MomentSquircle({ moment, size, onPress, reactionBadge }: MomentSquircleProps) {
  const radius = size * 0.28;

  const content = (
    <View style={[styles.outer, { width: size, height: size }]}>
      <View style={[styles.wrap, { width: size, height: size, borderRadius: radius }]}>
        {moment.type === 'video' && moment.media_url ? (
          <>
            <MomentVideoPlayer uri={moment.media_url} width={size} height={size} autoPlay={false} />
            <View style={styles.videoIcon}>
              <Icon name="videocam" size={11} color="#fff" />
            </View>
          </>
        ) : moment.media_url ? (
          <Image source={{ uri: moment.media_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallback]}>
            <Icon name="heart" size={size * 0.28} color="rgba(255,255,255,0.5)" filled />
          </View>
        )}
      </View>

      {reactionBadge && (
        <View style={styles.reactionBadge}>
          <Text style={styles.reactionEmoji}>{reactionBadge.emoji}</Text>
          {reactionBadge.count > 1 && (
            <View style={styles.reactionCount}>
              <Text style={styles.reactionCountText}>{reactionBadge.count}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [{ width: size, height: size }, pressed && { opacity: 0.9 }]}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  outer: { position: 'relative', overflow: 'visible' },
  wrap: { overflow: 'hidden', backgroundColor: '#1a1a1a', position: 'relative' },
  fallback: { backgroundColor: '#2a2a35', alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  videoIcon: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: '#000',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
    zIndex: 10,
  },
  reactionEmoji: { fontSize: 17 },
  reactionCount: {
    position: 'absolute',
    top: -5,
    right: -5,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FF3040',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#000',
  },
  reactionCountText: { color: '#fff', fontSize: 9, fontWeight: '800' },
});
