import { type ReactNode, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector, type GestureType } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Settling into place: quick and calm, no bounce. */
/** No gestures (one shared empty list, so the memo doesn't change every render). */
const NONE: GestureType[] = [];

const SETTLE = { duration: 220, easing: Easing.out(Easing.cubic) };

type Props = {
  /** Size at 1× (it grows and shrinks from here with two fingers). */
  width: number;
  height: number;
  /** Where it starts: a corner. */
  corner?: 'top-right' | 'bottom-right';
  /** Space kept clear at the top and bottom (headers, the tab bar, the call controls). */
  topClear?: number;
  bottomClear?: number;
  minScale?: number;
  maxScale?: number;
  /** Lets go next to the nearest side (the minimised call), or stays where it's dropped. */
  snapToSide?: boolean;
  onTap?: () => void;
  /** Taps on these (e.g. an end button inside) don't count as a tap on the window. */
  tapBlockers?: GestureType[];
  /** Gestures behind it that wait while it's being dragged (e.g. swipe down to minimise). */
  blocks?: GestureType[];
  style?: ViewStyle;
  children: ReactNode;
};

/**
 * A floating video window, like FaceTime's: drag it anywhere, pinch with two fingers to
 * make it bigger or smaller, and it always stays on screen.
 */
export function DraggableWindow({
  width,
  height,
  corner = 'bottom-right',
  topClear = 0,
  bottomClear = 0,
  minScale = 0.75,
  maxScale = 2,
  snapToSide = false,
  onTap,
  tapBlockers = NONE,
  blocks = NONE,
  style,
  children,
}: Props) {
  const screen = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const margin = 12;
  const top = insets.top + topClear + margin;
  const bottom = screen.height - insets.bottom - bottomClear - margin;

  const x = useSharedValue(screen.width - width - margin);
  const y = useSharedValue(corner === 'top-right' ? top : bottom - height);
  const scale = useSharedValue(1);
  const from = useSharedValue({ x: 0, y: 0, scale: 1 });

  // Made once per layout, not on every render: a parent that re-renders every second (the
  // call timer) would otherwise swap the gesture out mid-drag, and the drag would stop.
  const gesture = useMemo(() => {
    /** Back inside the screen (and to a side, if it snaps), at its current size. */
    const settle = () => {
      'worklet';
      const w = width * scale.value;
      const h = height * scale.value;
      const maxX = screen.width - w - margin;
      const nextX = snapToSide
        ? x.value + w / 2 < screen.width / 2
          ? margin
          : maxX
        : Math.min(Math.max(x.value, margin), maxX);
      const nextY = Math.min(Math.max(y.value, top), Math.max(top, bottom - h));
      x.value = withTiming(nextX, SETTLE);
      y.value = withTiming(nextY, SETTLE);
    };

    const pan = Gesture.Pan()
      .minDistance(4)
      .onStart(() => {
        from.value = { x: x.value, y: y.value, scale: scale.value };
      })
      .onUpdate((e) => {
        x.value = from.value.x + e.translationX;
        y.value = from.value.y + e.translationY;
      })
      .onEnd(() => settle());

    const pinch = Gesture.Pinch()
      .enabled(maxScale > minScale)
      .onStart(() => {
        from.value = { x: x.value, y: y.value, scale: scale.value };
      })
      .onUpdate((e) => {
        scale.value = Math.min(maxScale, Math.max(minScale, from.value.scale * e.scale));
      })
      .onEnd(() => settle());

    let tap = Gesture.Tap()
      .maxDuration(300)
      .onEnd((_e, ok) => {
        if (ok && onTap) runOnJS(onTap)();
      });
    if (tapBlockers.length) tap = tap.requireExternalGestureToFail(...tapBlockers);

    if (blocks.length) {
      pan.blocksExternalGesture(...blocks);
      pinch.blocksExternalGesture(...blocks);
    }
    return Gesture.Exclusive(Gesture.Simultaneous(pan, pinch), tap);
    // Shared values are stable; the gesture follows the layout and the blockers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, screen.width, top, bottom, minScale, maxScale, snapToSide, onTap, tapBlockers, blocks]);

  const animated = useAnimatedStyle(() => ({
    width: width * scale.value,
    height: height * scale.value,
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.window, style, animated]}>{children}</Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  window: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
});
