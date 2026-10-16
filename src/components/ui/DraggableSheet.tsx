import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
  type ScrollViewProps,
} from 'react-native';
import { Gesture, GestureDetector, type NativeGesture } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;
const OPEN_SPRING = { damping: 26, stiffness: 260, mass: 0.9 };
const SNAP_BACK_SPRING = { damping: 26, stiffness: 300 };

type SheetScrollContext = {
  native: NativeGesture;
  scrollY: SharedValue<number>;
  hasScroll: SharedValue<boolean>;
};
const SheetScroll = createContext<SheetScrollContext | null>(null);

/**
 * A scroll area inside a `dragAnywhere` DraggableSheet: the content scrolls,
 * and a drag that starts with the list at the top moves the sheet instead.
 */
export function SheetScrollView({ children, style, ...rest }: ScrollViewProps & { children: ReactNode }) {
  const ctx = useContext(SheetScroll);
  const fallbackY = useSharedValue(0);
  const scrollY = ctx?.scrollY ?? fallbackY;
  const hasScroll = ctx?.hasScroll;
  useEffect(() => {
    if (!hasScroll) return;
    hasScroll.set(true);
    return () => {
      hasScroll.value = false;
    };
  }, [hasScroll]);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  const list = (
    <Animated.ScrollView
      {...rest}
      style={[{ flexShrink: 1 }, style]}
      bounces={false}
      showsVerticalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={onScroll}>
      {children}
    </Animated.ScrollView>
  );
  return ctx ? <GestureDetector gesture={ctx.native}>{list}</GestureDetector> : list;
}

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
  /**
   * Drag down from anywhere on the sheet, not just the handle. For sheets
   * whose content doesn't scroll (a grid of choices) — easier to dismiss.
   */
  dragAnywhere?: boolean;
  /**
   * Draw inside the current screen instead of as its own Modal: for sheets over
   * a screen that is itself a full-screen Modal (Moments), where a second
   * native Modal can't present on top.
   */
  inline?: boolean;
}

/**
 * A sheet's content outlives its prop by one slide: when the page sets `entry` to
 * null, the sheet still shows the last one while it slides away, instead of
 * collapsing to an empty handle mid-close.
 */
export function useKeptWhileClosing<T>(value: T | null | undefined): T | null {
  const [kept, setKept] = useState<T | null>(value ?? null);
  if (value != null && value !== kept) setKept(value);
  return value ?? kept;
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
  dragAnywhere = false,
  inline = false,
}: DraggableSheetProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(SCREEN_HEIGHT);
  const backdropOpacity = useSharedValue(0);
  // For a SheetScrollView inside: its scroll offset, whether one is mounted,
  // and whether the current drag moves the sheet (decided once, on touch
  // down — a drag that starts mid-list only ever scrolls the list).
  const scrollY = useSharedValue(0);
  const hasScroll = useSharedValue(false);
  const dragsSheet = useSharedValue(true);
  const native = useMemo(() => Gesture.Native(), []);
  const scrollCtx = useMemo(() => ({ native, scrollY, hasScroll }), [native, scrollY, hasScroll]);

  const finishClose = useCallback(() => {
    setMounted(false);
    onClose();
  }, [onClose]);

  const animateOut = useCallback(
    (velocityY = 0) => {
      const duration = Math.max(140, 260 - Math.abs(velocityY) / 14);
      translateY.set(
        withTiming(SCREEN_HEIGHT, { duration, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(finishClose)();
        }),
      );
      backdropOpacity.set(withTiming(0, { duration: Math.min(duration, 180) }));
    },
    [translateY, backdropOpacity, finishClose],
  );

  useEffect(() => {
    if (visible) {
      setMounted(true);
      translateY.set(SCREEN_HEIGHT);
      translateY.value = withSpring(0, OPEN_SPRING);
      backdropOpacity.set(withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }));
    } else if (mounted) {
      animateOut(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const pan = Gesture.Pan()
    .enabled(dragEnabled)
    .activeOffsetY([-6, 6])
    .failOffsetX([-14, 14])
    .simultaneousWithExternalGesture(native)
    .onBegin(() => {
      dragsSheet.value = scrollY.value <= 0;
    })
    .onUpdate((event) => {
      if (!dragsSheet.value) return;
      // Started at the top but went up into the list: it's a scroll now.
      if (hasScroll.value && scrollY.value > 0 && translateY.value <= 0) {
        dragsSheet.value = false;
        return;
      }
      const dy = event.translationY;
      translateY.set(dy > 0 ? dy : hasScroll.value ? 0 : dy * 0.2);
    })
    .onEnd((event) => {
      if (!dragsSheet.value) {
        if (translateY.value !== 0) translateY.set(withSpring(0, SNAP_BACK_SPRING));
        return;
      }
      const shouldClose =
        translateY.value > 0 &&
        (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY);

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

  const Shell = inline ? InlineShell : ModalShell;
  return (
    <Shell onRequestClose={() => animateOut(0)}>
      <Container style={styles.overlay} {...containerProps}>
        {/* The dim fades with the sheet (it used to sit on the container: full strength
            the whole time, then gone in one frame after closing — the blink). */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.dim, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={closeOnBackdropPress ? () => animateOut(0) : undefined}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheet,
            { backgroundColor: colors.surfaceElevated, paddingBottom: Math.max(32, insets.bottom + 20) },
            sheetStyle,
            style,
          ]}>
          {dragAnywhere ? (
            <SheetScroll.Provider value={scrollCtx}>
              <GestureDetector gesture={pan}>
                <View style={styles.dragArea}>
                  <View style={styles.handleTouchTarget}>
                    <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
                  </View>
                  {children}
                </View>
              </GestureDetector>
            </SheetScroll.Provider>
          ) : (
            <>
              <GestureDetector gesture={pan}>
                <View style={styles.handleTouchTarget} hitSlop={{ top: 8, bottom: 8, left: 24, right: 24 }}>
                  <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
                </View>
              </GestureDetector>
              {children}
            </>
          )}
        </Animated.View>
      </Container>
    </Shell>
  );
}

function ModalShell({ onRequestClose, children }: { onRequestClose: () => void; children: ReactNode }) {
  return (
    // Edge to edge on Android too, so the dim also covers the status bar (no band of colour left at the top).
    <Modal visible transparent animationType="none" statusBarTranslucent navigationBarTranslucent onRequestClose={onRequestClose}>
      {children}
    </Modal>
  );
}

/** Same sheet, drawn over the current screen (absolute fill) instead of in its own Modal. */
function InlineShell({ children }: { onRequestClose: () => void; children: ReactNode }) {
  return <View style={StyleSheet.absoluteFill}>{children}</View>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  dim: { backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    maxHeight: '84%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
  },
  dragArea: { flexShrink: 1 },
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
