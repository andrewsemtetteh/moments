import { MomentThumbImage } from '@/components/moments/MomentThumbImage';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { Pressable as GHPressable } from 'react-native-gesture-handler';

import { Avatar } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { momentHasVisual } from '@/lib/moment-display';
import type { Moment } from '@/types/database';

const STORY_GRADIENT = ['#5b8def', '#9b6bff', '#e85d75'] as const;

interface PartnerStoryAvatarProps {
  name?: string | null;
  avatarUrl?: string | null;
  activeMoments: Moment[];
  size?: number;
  showOnline?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  accessibilityLabel?: string;
  /** When false, renders visuals only (parent handles gestures). */
  interactive?: boolean;
}

export function PartnerStoryAvatar({
  name,
  avatarUrl,
  activeMoments,
  size = 108,
  showOnline = false,
  onPress,
  onLongPress,
  accessibilityLabel,
  interactive = true,
}: PartnerStoryAvatarProps) {
  const { colors } = useTheme();
  const hasMoment = activeMoments.length > 0;
  const latestMoment = activeMoments[0];
  // Their latest moment as a picture (a video's still, never the video file), else their photo.
  const momentPicture = latestMoment && momentHasVisual(latestMoment) ? latestMoment : null;
  const ring = size + 12;
  const inner = size + 4;
  const clip = size;

  const body = hasMoment ? (
    <LinearGradient
      colors={[...STORY_GRADIENT]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.storyRing, { width: ring, height: ring, borderRadius: ring / 2 }]}>
      <View
        style={[
          styles.storyInner,
          { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: colors.background },
        ]}>
        <View style={[styles.storyClip, { width: clip, height: clip, borderRadius: clip / 2 }]}>
          {momentPicture ? (
            <MomentThumbImage moment={momentPicture} style={{ width: clip, height: clip }} playMark={false} />
          ) : (
            <Avatar name={name} imageUrl={avatarUrl} size={clip} />
          )}
        </View>
      </View>
      {showOnline && <View style={[styles.onlineDot, { backgroundColor: colors.success, borderColor: colors.background }]} />}
    </LinearGradient>
  ) : (
    <View style={styles.plainWrap}>
      <Avatar name={name} imageUrl={avatarUrl} size={size} />
      {showOnline && <View style={[styles.onlineDot, { backgroundColor: colors.success, borderColor: colors.background }]} />}
    </View>
  );

  if (!interactive) return body;

  return (
    <GHPressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      disabled={!hasMoment && !avatarUrl?.trim() && !name?.trim()}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? (hasMoment ? 'View partner moment' : 'View profile photo')}
      accessibilityHint={hasMoment ? 'Long press for profile photo' : undefined}>
      {body}
    </GHPressable>
  );
}

const styles = StyleSheet.create({
  storyRing: { alignItems: 'center', justifyContent: 'center', position: 'relative' },
  storyInner: { alignItems: 'center', justifyContent: 'center' },
  storyClip: { overflow: 'hidden' },
  plainWrap: { position: 'relative' },
  onlineDot: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
});
