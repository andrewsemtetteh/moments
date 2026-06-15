import { useMemo } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, Pressable } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

import { MomentBlobFrame } from '@/components/moments/MomentBlobFrame';
import { MomentVideoPlayer } from '@/components/moments/MomentVideoPlayer';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import type { Moment } from '@/types/database';

const BLOB_ASPECT = 1.12;
const MAX_LAYERS = 3;
const SWIPE_THRESHOLD = 48;

export function momentMediaBadgeLayout(width: number) {
  const size = Math.round(width * 0.17);
  const inset = Math.round(width * 0.04);
  return { size, inset, emojiSize: Math.round(size * 0.54) };
}

const LAYER_STYLES: ViewStyle[] = [
  { transform: [{ translateX: -34 }, { translateY: -30 }, { rotate: '-9deg' }, { scale: 0.8 }] },
  { transform: [{ translateX: 30 }, { translateY: -24 }, { rotate: '8deg' }, { scale: 0.87 }] },
  { transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 1 }] },
];

interface SwipeableMomentMediaStackProps {
  moments: Moment[];
  width: number;
  activeIndex: number;
  onIndexChange: (index: number) => void;
  onPress?: () => void;
  reactionEmoji?: string | null;
  onReactionBadgePress?: () => void;
}

export function SwipeableMomentMediaStack({
  moments,
  width,
  activeIndex,
  onIndexChange,
  onPress,
  reactionEmoji,
  onReactionBadgePress,
}: SwipeableMomentMediaStackProps) {
  const { colors } = useTheme();
  const badge = momentMediaBadgeLayout(width);

  const visibleStack = useMemo(
    () => moments.slice(activeIndex, activeIndex + MAX_LAYERS),
    [moments, activeIndex],
  );

  const goNext = () => {
    if (activeIndex < moments.length - 1) onIndexChange(activeIndex + 1);
  };

  const goPrev = () => {
    if (activeIndex > 0) onIndexChange(activeIndex - 1);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .onEnd((e) => {
      if (e.translationX < -SWIPE_THRESHOLD) runOnJS(goNext)();
      else if (e.translationX > SWIPE_THRESHOLD) runOnJS(goPrev)();
    });

  const height = width * BLOB_ASPECT;
  const stackDepth = visibleStack.length;
  const topInset = stackDepth > 1 ? 36 : 0;
  const ordered = [...visibleStack].reverse();

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.stack, { width, height: height + topInset + (moments.length > 1 ? 18 : 0) }]}>
        {ordered.map((moment, layerIdx) => {
          const isFront = layerIdx === ordered.length - 1;
          const styleIdx = styleIndexForLayer(layerIdx, ordered.length);
          const tile = <MomentStackTile moment={moment} width={width} isFront={isFront} />;

          return (
            <View
              key={moment.id}
              style={[
                styles.layer,
                { width, height, top: topInset },
                LAYER_STYLES[styleIdx],
                { zIndex: layerIdx + 1 },
                !isFront && styles.layerBack,
              ]}>
              {isFront && onPress ? (
                <Pressable onPress={onPress} style={{ width, height }}>
                  {tile}
                </Pressable>
              ) : (
                tile
              )}
              {isFront && reactionEmoji && onReactionBadgePress && (
                <Pressable
                  onPress={onReactionBadgePress}
                  style={[
                    styles.reactionBadge,
                    {
                      top: badge.inset,
                      right: badge.inset,
                      width: badge.size,
                      height: badge.size,
                      borderRadius: badge.size / 2,
                      backgroundColor: colors.surfaceElevated,
                      borderColor: colors.border,
                    },
                  ]}
                  accessibilityLabel="Change reaction">
                  <Text style={{ fontSize: badge.emojiSize }}>{reactionEmoji}</Text>
                </Pressable>
              )}
            </View>
          );
        })}
        {moments.length > 1 && (
          <View style={[styles.dots, { top: topInset + height + 6 }]}>
            {moments.slice(0, Math.min(moments.length, 5)).map((m, i) => (
              <View
                key={m.id}
                style={[
                  styles.dot,
                  { backgroundColor: colors.textTertiary },
                  i === activeIndex && [styles.dotActive, { backgroundColor: colors.text }],
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

function styleIndexForLayer(layerIdx: number, total: number) {
  if (total === 1) return 2;
  if (total === 2) return layerIdx === 0 ? 0 : 2;
  return layerIdx;
}

function MomentStackTile({
  moment,
  width,
  isFront,
}: {
  moment: Moment;
  width: number;
  isFront: boolean;
}) {
  const isVideo = moment.type === 'video' && !!moment.media_url;

  if (isVideo) {
    return (
      <View style={{ width, height: width * BLOB_ASPECT, borderRadius: 24, overflow: 'hidden' }}>
        <MomentVideoPlayer uri={moment.media_url!} fill autoPlay={isFront} />
      </View>
    );
  }

  if (moment.type === 'photo' && moment.media_url) {
    return <MomentBlobFrame width={width} imageUri={moment.media_url} />;
  }

  return (
    <MomentBlobFrame width={width} fill="#2a2a35">
      <Icon name="heart" size={36} color="rgba(255,255,255,0.5)" filled />
    </MomentBlobFrame>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'relative',
    alignSelf: 'center',
  },
  layer: {
    position: 'absolute',
    left: 0,
    alignItems: 'center',
    overflow: 'visible',
  },
  layerBack: {
    opacity: 0.9,
  },
  reactionBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    zIndex: 30,
  },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
