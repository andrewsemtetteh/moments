import { type ReactNode } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const DISMISS_THRESHOLD = 56;
const DISMISS_VELOCITY = 650;

/**
 * Full-screen swipe to dismiss. Vertical scroll in children is unaffected.
 * - `start`: swipe right — notifications / back
 * - `end`: swipe left — chat close
 */
export type SwipeDismissEdge = 'start' | 'end';

interface Props {
  children: ReactNode;
  onDismiss: () => void;
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
    .activeOffsetX(edge === 'start' ? 12 : -12)
    .failOffsetX(edge === 'start' ? -8 : 8)
    .failOffsetY([-12, 12])
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
        runOnJS(onDismiss)();
        return;
      }

      translateX.value = withSpring(0, { damping: 24, stiffness: 340 });
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[{ flex: 1 }, style, animatedStyle]}
        accessibilityLabel={edge === 'start' ? 'Swipe right to go back' : 'Swipe left to close'}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}
