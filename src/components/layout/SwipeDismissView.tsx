import { ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const DISMISS_THRESHOLD = 72;
const DISMISS_VELOCITY = 850;

/**
 * Which screen edge the back/close control sits on (LTR).
 * - `start` (left): swipe right to dismiss — chevronLeft / Back
 * - `end` (right): swipe left to dismiss — chevronRight / close on the right
 */
export type SwipeDismissEdge = 'start' | 'end';

interface Props {
  children: ReactNode;
  onDismiss: () => void;
  /** Match the side where the back/close button lives. */
  edge?: SwipeDismissEdge;
  style?: StyleProp<ViewStyle>;
  enabled?: boolean;
}

export function SwipeDismissView({
  children,
  onDismiss,
  edge = 'start',
  style,
  enabled = true,
}: Props) {
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX(edge === 'start' ? 18 : -18)
    .failOffsetX(edge === 'start' ? -10 : 10)
    .failOffsetY([-12, 12])
    .onUpdate((event) => {
      if (edge === 'start' && event.translationX > 0) {
        translateX.value = event.translationX;
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
        runOnJS(onDismiss)();
        return;
      }

      translateX.value = withSpring(0, { damping: 22, stiffness: 260 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[{ flex: 1 }, style, animatedStyle]}>{children}</Animated.View>
    </GestureDetector>
  );
}
