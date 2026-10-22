import { useIsFocused } from 'expo-router';
import { forwardRef, useEffect, useImperativeHandle, type ReactNode } from 'react';
import { StyleProp, ViewStyle, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';

const DISMISS_THRESHOLD = 56;
const DISMISS_VELOCITY = 650;
/** Carries release velocity through so a fast flick keeps its momentum instead of snapping at a fixed rate. */
const SETTLE_SPRING = { damping: 32, stiffness: 280, mass: 0.9 };

/**
 * Full-screen swipe to dismiss, with a matching slide-in whenever the screen
 * gains focus — whether it was opened by swiping or by tapping an icon — and
 * a matching slide-out via the exposed `dismiss()` handle for tap-triggered
 * closes (a back button), not just swipe-triggered ones.
 * - `start`: lives to the right — enters sliding in from the right, swipe right to dismiss
 * - `end`: lives to the left — enters sliding in from the left, swipe left to dismiss
 */
export type SwipeDismissEdge = 'start' | 'end';

export interface SwipeDismissViewHandle {
  /** Plays the same slide-out-then-dismiss animation as a completed swipe. */
  dismiss: () => void;
}

interface Props {
  children: ReactNode;
  onDismiss: () => void;
  edge?: SwipeDismissEdge;
  style?: StyleProp<ViewStyle>;
  enabled?: boolean;
  /**
   * Set false when a parent already animates this screen in (a native
   * `<Modal>` or a Stack screen with its own `animation`) — keeps the
   * swipe-to-dismiss gesture without stacking a second, conflicting
   * entrance motion on top of the parent's.
   */
  animateEntrance?: boolean;
}

export const SwipeDismissView = forwardRef<SwipeDismissViewHandle, Props>(
  function SwipeDismissView(
    { children, onDismiss, edge = 'start', style, enabled = true, animateEntrance = true },
    ref,
  ) {
    const { colors } = useTheme();
    const isFocused = useIsFocused();
    // Read live, so a fold / unfold, split screen or rotation redraws at the new size.
    const SCREEN_WIDTH = useWindowDimensions().width;
    const closedPosition = edge === 'start' ? SCREEN_WIDTH : -SCREEN_WIDTH;
    const translateX = useSharedValue(animateEntrance && isFocused ? closedPosition : 0);

    useEffect(() => {
      if (!animateEntrance || !isFocused) return;
      translateX.value = closedPosition;
      translateX.value = withSpring(0, SETTLE_SPRING);
    }, [animateEntrance, isFocused, closedPosition, translateX]);

    useImperativeHandle(ref, () => ({
      dismiss: () => {
        translateX.value = withSpring(closedPosition, SETTLE_SPRING, (finished) => {
          if (finished) runOnJS(onDismiss)();
        });
      },
    }));

    const pan = Gesture.Pan()
      .enabled(enabled)
      .activeOffsetX(edge === 'start' ? 10 : -10)
      .failOffsetX(edge === 'start' ? -8 : 8)
      .failOffsetY([-20, 20])
      .onUpdate((event) => {
        if (edge === 'start' && event.translationX > 0) {
          translateX.value = event.translationX;
          return;
        }
        if (edge === 'end' && event.translationX < 0) {
          translateX.value = event.translationX;
        }
      })
      .onEnd((event) => {
        const shouldDismiss =
          edge === 'start'
            ? event.translationX > DISMISS_THRESHOLD || event.velocityX > DISMISS_VELOCITY
            : event.translationX < -DISMISS_THRESHOLD || event.velocityX < -DISMISS_VELOCITY;

        if (shouldDismiss) {
          translateX.value = withSpring(
            closedPosition,
            { ...SETTLE_SPRING, velocity: event.velocityX },
            (finished) => {
              if (finished) runOnJS(onDismiss)();
            },
          );
          return;
        }

        translateX.value = withSpring(0, { ...SETTLE_SPRING, velocity: event.velocityX });
      });

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ translateX: translateX.value }],
    }));

    return (
      <GestureDetector gesture={pan}>
        <Animated.View
          style={[{ flex: 1, backgroundColor: colors.background }, style, animatedStyle]}
          accessibilityLabel={edge === 'start' ? 'Swipe right to go back' : 'Swipe left to close'}>
          {children}
        </Animated.View>
      </GestureDetector>
    );
  },
);
