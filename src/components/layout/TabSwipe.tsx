import * as Haptics from '@/lib/haptics';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

const TRIGGER_DISTANCE = 70;
const TRIGGER_VELOCITY = 500;
/**
 * A fast flick still needs to have travelled this far. Speed alone used to switch tabs
 * when someone quickly scrolled a sideways row (Play's rails, the moments on Home).
 */
const FLICK_MIN_DISTANCE = 45;
/**
 * A swipe has to travel 25pt before it counts — a little more than the moments
 * card's own 20pt swipe, so dragging on the card flips photos first.
 */
const ACTIVATE_AFTER = 25;

/**
 * Swipe anywhere on a tab to move along the row
 *
 *   Together ← Home ↔ Play ↔ You → Settings
 *
 * Swipe right = one place left, swipe left = one place right. Taps and
 * vertical scrolling are never affected — only a clear sideways drag.
 */
export function TabSwipe({
  onSwipeLeft,
  onSwipeRight,
  children,
}: {
  /** Finger moves right → left: go to the page on the right. */
  onSwipeLeft?: () => void;
  /** Finger moves left → right: go to the page on the left. */
  onSwipeRight?: () => void;
  children: ReactNode;
}) {
  const go = (fn: () => void) => {
    void Haptics.selectionAsync();
    fn();
  };
  const left = () => onSwipeLeft && go(onSwipeLeft);
  const right = () => onSwipeRight && go(onSwipeRight);
  const canLeft = !!onSwipeLeft;
  const canRight = !!onSwipeRight;

  const swipe = Gesture.Pan()
    .activeOffsetX([canLeft ? -ACTIVATE_AFTER : -10_000, canRight ? ACTIVATE_AFTER : 10_000])
    .failOffsetY([-20, 20])
    .onEnd((e) => {
      // Mostly sideways, and either far enough or a real flick that's travelled a bit.
      if (Math.abs(e.translationY) > Math.abs(e.translationX) * 0.6) return;
      const flickRight = e.velocityX > TRIGGER_VELOCITY && e.translationX > FLICK_MIN_DISTANCE;
      const flickLeft = e.velocityX < -TRIGGER_VELOCITY && e.translationX < -FLICK_MIN_DISTANCE;
      if (canRight && (e.translationX > TRIGGER_DISTANCE || flickRight)) {
        runOnJS(right)();
      } else if (canLeft && (e.translationX < -TRIGGER_DISTANCE || flickLeft)) {
        runOnJS(left)();
      }
    });

  return (
    <GestureDetector gesture={swipe}>
      <View style={styles.fill}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
