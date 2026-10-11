import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

/** How far in from the edge a swipe can start — a third of the screen. */
const EDGE_WIDTH = Math.round(Dimensions.get('window').width / 3);
const TRIGGER_DISTANCE = 60;
const TRIGGER_VELOCITY = 500;

/**
 * Swipe toward the middle to open something — Together from Home's left side,
 * Settings from You's right side, mirroring where their buttons sit.
 * - `fullScreen`: the swipe can start anywhere (pages with nothing sideways).
 * - otherwise only within the third of the screen on that side.
 * Taps are never affected — only a clear sideways drag opens it.
 */
export function EdgeSwipe({
  edge,
  fullScreen = false,
  onOpen,
  children,
}: {
  /** `left`: swipe right from the left side. `right`: swipe left from the right side. */
  edge: 'left' | 'right';
  fullScreen?: boolean;
  onOpen: () => void;
  children: ReactNode;
}) {
  const open = () => {
    void Haptics.selectionAsync();
    onOpen();
  };

  const swipe = Gesture.Pan()
    .hitSlop(fullScreen ? undefined : edge === 'left' ? { left: 0, width: EDGE_WIDTH } : { right: 0, width: EDGE_WIDTH })
    // 25pt: a little more than the moments card's own 20pt swipe, so when you
    // drag on the card it flips photos first instead of opening the page.
    .activeOffsetX(edge === 'left' ? 25 : -25)
    .failOffsetX(edge === 'left' ? -10 : 10)
    .failOffsetY([-20, 20])
    .onEnd((e) => {
      const dx = edge === 'left' ? e.translationX : -e.translationX;
      const vx = edge === 'left' ? e.velocityX : -e.velocityX;
      if (dx > TRIGGER_DISTANCE || vx > TRIGGER_VELOCITY) runOnJS(open)();
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
