import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { MomentVideoPlayer } from '@/components/moments/MomentVideoPlayer';
import { useTheme } from '@/hooks/useTheme';
import { momentChrome } from '@/lib/moment-theme';
import type { Moment } from '@/types/database';

interface MomentSquircleProps {
  moment: Moment;
  size: number;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Counter-party reaction — notification badge top-right */
  reactionBadge?: { emoji: string; count: number } | null;
  selecting?: boolean;
  selected?: boolean;
}

export function MomentSquircle({
  moment,
  size,
  onPress,
  onLongPress,
  reactionBadge,
  selecting = false,
  selected = false,
}: MomentSquircleProps) {
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const radius = size * 0.28;

  const content = (
    <View style={[styles.outer, { width: size, height: size }]}>
      <View
        style={[
          styles.wrap,
          { width: size, height: size, borderRadius: radius, backgroundColor: chrome.placeholder },
          selecting && selected && { borderWidth: 2, borderColor: chrome.accent },
        ]}>
        {moment.type === 'video' && moment.media_url ? (
          <>
            <MomentVideoPlayer uri={moment.media_url} width={size} height={size} autoPlay={false} />
            <View style={styles.videoIcon}>
              <Icon name="videocam" size={11} color={chrome.onMedia} />
            </View>
          </>
        ) : moment.media_url ? (
          <Image source={{ uri: moment.media_url }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.fallback, { backgroundColor: chrome.surface }]}>
            <Icon name="heart" size={size * 0.28} color={chrome.textTertiary} filled />
          </View>
        )}

        {selecting && (
          <View style={[styles.selectOverlay, selected && styles.selectOverlayActive]}>
            <View
              style={[
                styles.selectCircle,
                { borderColor: chrome.text },
                selected && { backgroundColor: chrome.accent, borderColor: chrome.accent },
              ]}>
              {selected && <Icon name="check" size={14} color={chrome.onAccent} />}
            </View>
          </View>
        )}
      </View>

      {reactionBadge && !selecting && (
        <View style={[styles.reactionBadge, { backgroundColor: chrome.surface, borderColor: chrome.background }]}>
          <Text style={styles.reactionEmoji}>{reactionBadge.emoji}</Text>
          {reactionBadge.count > 1 && (
            <View style={[styles.reactionCount, { backgroundColor: chrome.error, borderColor: chrome.background }]}>
              <Text style={[styles.reactionCountText, { color: chrome.onAccent }]}>{reactionBadge.count}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  if (onPress || onLongPress) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={320}
        style={({ pressed }) => [{ width: size, height: size }, pressed && { opacity: 0.9 }]}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  outer: { position: 'relative', overflow: 'visible' },
  wrap: { overflow: 'hidden', position: 'relative' },
  fallback: { alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
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
  selectOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.25)',
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    padding: 6,
  },
  selectOverlayActive: { backgroundColor: 'rgba(255,255,255,0.12)' },
  selectCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.35)',
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
  },
  reactionCountText: { fontSize: 9, fontWeight: '800' },
});
