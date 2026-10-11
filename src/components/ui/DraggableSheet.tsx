import { useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;
const OPEN_SPRING = { damping: 26, stiffness: 260, mass: 0.9 };
const SNAP_BACK_SPRING = { damping: 26, stiffness: 300 };

interface DraggableSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  closeOnBackdropPress?: boolean;
  /** Disable the drag-to-dismiss handle (e.g. for sheets with no natural rest position). */
  dragEnabled?: boolean;
  /** Pad the sheet above the keyboard, for sheets with a text input. */
  avoidKeyboard?: boolean;
}

/**
 * Bottom sheet with a real drag-to-dismiss handle: rubber-bands past its rest
 * position, snaps back under threshold, and finishes the slide off-screen
 * (rather than jump-cutting) before unmounting on both gesture and
 * backdrop/programmatic close.
 */
export function DraggableSheet({
  visible,
  onClose,
  children,
  style,
  closeOnBackdropPress = true,
  dragEnabled = true,
  avoidKeyboard = false,
}: DraggableSheetProps) {
  const { colors } = useTheme();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);

  const finishClose = useCallback(() => {
    setMounted(false);
    onClose();
  }, [onClose]);

  const animateOut = useCallback(
    (velocityY = 0) => {
      const duration = Math.max(140, 260 - Math.abs(velocityY) / 14);
      translateY.value = withTiming(
        SCREEN_HEIGHT,
        { duration, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(finishClose)();
        },
      );
      backdropOpacity.value = withTiming(0, { duration: Math.min(duration, 180) });
    },
    [translateY, backdropOpacity, finishClose],
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.value = SCREEN_HEIGHT;
      translateY.value = withSpring(0, OPEN_SPRING);
      backdropOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
    } else if (mounted) {
      animateOut(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = Gesture.Pan()
    .enabled(dragEnabled)
    .activeOffsetY([-6, 6])
    .failOffsetX([-14, 14])
    .onUpdate((event) => {
      const dy = event.translationY;
      translateY.value = dy > 0 ? dy : dy * 0.2;
    })
    .onEnd((event) => {
      const shouldClose =
        event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY;

      if (shouldClose) {
        runOnJS(animateOut)(event.velocityY);
        return;
      }

      translateY.value = withSpring(0, SNAP_BACK_SPRING);
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  if (!mounted) return null;

  const Container = avoidKeyboard ? KeyboardAvoidingView : View;
  const containerProps = avoidKeyboard
    ? { behavior: Platform.OS === 'ios' ? ('padding' as const) : undefined }
    : {};

  return (
    <Modal visible transparent animationType="none" onRequestClose={() => animateOut(0)}>
      <Container style={styles.overlay} {...containerProps}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeOnBackdropPress ? () => animateOut(0) : undefined}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.surfaceElevated },
            sheetStyle,
            style,
          ]}>
          <GestureDetector gesture={pan}>
            <View style={styles.handleTouchTarget} hitSlop={{ top: 8, bottom: 8, left: 24, right: 24 }}>
              <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
            </View>
          </GestureDetector>
          {children}
        </Animated.View>
      </Container>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '84%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  handleTouchTarget: {
    alignSelf: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
});
