import { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const DISMISS_THRESHOLD = 72;
const DISMISS_VELOCITY = 850;
const EDGE_WIDTH = 20;

interface Props {
  children: ReactNode;
  onDismiss: () => void;
}

/**
 * Full-screen slide + scroll-friendly back swipe for modals.
 * Vertical scroll stays on the child ScrollView; swipe-right starts from the left edge.
 */
export function SwipeBackSheet({ children, onDismiss }: Props) {
  const translateX = useSharedValue(0);

  const pan = Gesture.Pan()
    .activeOffsetX(10)
    .failOffsetX(-8)
    .failOffsetY([-16, 16])
    .onUpdate((event) => {
      if (event.translationX > 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.translationX > DISMISS_THRESHOLD || event.velocityX > DISMISS_VELOCITY;

      if (shouldDismiss) {
        runOnJS(onDismiss)();
        return;
      }

      translateX.value = withSpring(0, { damping: 22, stiffness: 260 });
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[styles.root, sheetStyle]}>
      {children}
      <GestureDetector gesture={pan}>
        <View style={styles.edgeZone} accessibilityLabel="Swipe right to go back" />
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  edgeZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: EDGE_WIDTH,
    zIndex: 20,
  },
});
