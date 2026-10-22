import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Modal, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';

import { KeyboardDismissRoot } from '@/components/layout/KeyboardDismissRoot';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { useTheme } from '@/hooks/useTheme';
import { ThemedStatusBar } from '@/components/ui/ThemedStatusBar';
import { ChoiceSheetHost } from '@/components/ui/ChoiceSheet';

const OPEN_SPRING = { damping: 30, stiffness: 280, mass: 0.9 };

/**
 * A full page pushed over the current screen (New plan, New memory): slides
 * in from the right, standard header (back · centered title · action), and
 * closes with the back arrow, a swipe right anywhere, or Android back.
 */
export function FullScreenPage({
  visible,
  title,
  onBack,
  right,
  avoidKeyboard = true,
  dismissKeyboardOnTap = false,
  overlay,
  swipeDownToClose = false,
  atTop,
  closeOnRight = false,
  floatingBack = false,
  headerTint,
  children,
}: {
  visible: boolean;
  /**
   * No header bar: the page's own top (a coloured band) runs up under the status bar and
   * scrolls away, with a floating back chip over it, like the streak page (the partner's profile).
   */
  floatingBack?: boolean;
  /** Text colour on that band, so the status bar icons match it. */
  headerTint?: string;
  title: string;
  /** Back arrow / swipe / hardware back. */
  onBack: () => void;
  /** Header action on the right (e.g. a ✓ save button). */
  right?: ReactNode;
  /**
   * Shrink the page above the keyboard (iOS). Turn off for long forms whose
   * ScrollView uses automaticallyAdjustKeyboardInsets instead, which also
   * scrolls the focused field into view.
   */
  avoidKeyboard?: boolean;
  /**
   * Tap empty space to close the keyboard. Only for forms (New plan, New memory,
   * Settings edits): the catcher can swallow a scroll view's drags, so pages
   * without fields leave it off (the default).
   */
  dismissKeyboardOnTap?: boolean;
  /** Drawn over the whole page (header included), outside its swipe-back: e.g. the full map. */
  overlay?: ReactNode;
  /** Also close with a swipe down (like an opened moment), when the page is scrolled to the top. */
  swipeDownToClose?: boolean;
  /** Whether the page's scroll is at the top (a swipe down there closes; elsewhere it scrolls). */
  atTop?: SharedValue<boolean>;
  /** A ✕ on the right instead of the back arrow; `right` then sits on the left. */
  closeOnRight?: boolean;
  children: ReactNode;
}) {
  // Read live, so a fold / unfold, split screen or rotation redraws at the new size.
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [mounted, setMounted] = useState(visible);
  const translateX = useSharedValue(SCREEN_W);
  // Swipe down to close (swipeDownToClose): how far it's been pulled, and where the touch began.
  const dragY = useSharedValue(0);
  const touchX = useSharedValue(0);
  const touchY = useSharedValue(0);
  // Opening mounts straight away (while rendering); closing waits for the slide-out below.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (visible) {
      dragY.value = 0;
      translateX.value = SCREEN_W;
      translateX.value = withSpring(0, OPEN_SPRING);
    } else if (mounted) {
      translateX.value = withTiming(SCREEN_W, { duration: 220 }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Swipe right anywhere on the page to go back. Only a clearly sideways drag
  // claims it, so the form still scrolls vertically.
  const swipeBack = Gesture.Pan()
    .activeOffsetX(14)
    .failOffsetX(-10)
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      translateX.set(Math.max(0, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX > SCREEN_W * 0.3 || e.velocityX > 700) {
        runOnJS(onBack)();
        return;
      }
      translateX.set(withSpring(0, OPEN_SPRING));
    });

  // Swipe down to close, as on an opened moment: only a clearly downward drag from the top of the
  // page claims it, so scrolling up and down and swiping sideways still work as before.
  const swipeDown = Gesture.Pan()
    .enabled(swipeDownToClose)
    .manualActivation(true)
    .onTouchesDown((e) => {
      const t = e.allTouches[0];
      if (!t) return;
      touchX.value = t.absoluteX;
      touchY.value = t.absoluteY;
    })
    .onTouchesMove((e, state) => {
      const t = e.allTouches[0];
      if (!t) return;
      const dx = t.absoluteX - touchX.value;
      const dy = t.absoluteY - touchY.value;
      if (dy < -8 || (Math.abs(dx) > 12 && Math.abs(dx) > dy)) {
        state.fail();
        return;
      }
      if (dy > 14 && (atTop ? atTop.value : true)) state.activate();
    })
    .onUpdate((e) => {
      dragY.set(Math.max(0, e.translationY));
    })
    .onEnd((e) => {
      if (e.translationY > SCREEN_H * 0.18 || e.velocityY > 900) {
        // Off the bottom, then closed: it's already out of sight, so nothing blank shows after.
        dragY.set(
          withTiming(SCREEN_H, { duration: 200 }, (done) => {
            if (done) runOnJS(onBack)();
          }),
        );
        return;
      }
      dragY.set(withSpring(0, OPEN_SPRING));
    });
  const pageGesture = Gesture.Race(swipeBack, swipeDown);

  const pageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: dragY.value }],
    borderRadius: dragY.value > 0 ? 28 : 0,
  }));

  // Pad the page above the keyboard; or (avoidKeyboard={false}) leave it to a keyboard-aware scroll
  // view inside, which brings the focused field into view itself. Same on iPhone and Android (the
  // keyboard library sees the keyboard here because the modal is edge to edge).
  const keyboardBehavior = avoidKeyboard ? 'padding' : undefined;

  if (!mounted) return null;

  const header = floatingBack ? null : closeOnRight ? (
    <ScreenHeader title={title} onClose={onBack} closeIcon left={right} />
  ) : (
    <ScreenHeader title={title} onBack={onBack} right={right} />
  );

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onBack}>
      <ThemedStatusBar style={headerTint ? (isLightColor(headerTint) ? 'light' : 'dark') : undefined} />
      <GestureHandlerRootView style={styles.flex}>
        <GestureDetector gesture={pageGesture}>
          <Animated.View style={[styles.flex, { backgroundColor: colors.background }, pageStyle]}>
            {/* Tapping anywhere that isn't a field or a button (header included) closes the
                keyboard. A modal is its own window, so the app-wide handler can't reach in here. */}
            <KeyboardDismissRoot enabled={dismissKeyboardOnTap !== false}>
              {header}
              <KeyboardAvoidingView style={styles.flex} behavior={keyboardBehavior}>
                {children}
              </KeyboardAvoidingView>
            </KeyboardDismissRoot>
            {floatingBack ? (
              <View pointerEvents="box-none" style={[styles.floatingBack, { top: insets.top + 6 }]}>
                <HeaderIconButton icon="chevronLeft" onPress={onBack} accessibilityLabel="Go back" chip />
              </View>
            ) : null}
          </Animated.View>
        </GestureDetector>
        {overlay}
        {/* Choices asked from this page ("Delete plan?") show over it. */}
        <ChoiceSheetHost inline />
      </GestureHandlerRootView>
    </Modal>
  );
}

/** Light text (white-ish) means the status bar icons go light too. */
function isLightColor(hex: string) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

function useKeyboardOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, () => setOpen(true));
    const hide = Keyboard.addListener(hideEvt, () => setOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return open;
}

const FOOTER_GAP = 12;

/**
 * Bottom bar for a page's main button (Save plan / Save memory): the same gap
 * above and below the button. Normally that sits above the home indicator;
 * while typing the inset is dropped so the gap to the keyboard matches.
 */
export function PageFooter({
  hideWhileTyping = false,
  children,
}: {
  /** Step aside while the keyboard is up so the form gets the room (the header ✓ still saves). */
  hideWhileTyping?: boolean;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardOpen = useKeyboardOpen();
  if (hideWhileTyping && keyboardOpen) return null;
  return (
    <View
      style={[
        styles.footer,
        {
          paddingBottom: keyboardOpen ? FOOTER_GAP : insets.bottom + FOOTER_GAP,
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        },
      ]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  floatingBack: { position: 'absolute', left: 20, zIndex: 20, elevation: 20 },
  flex: { flex: 1 },
  footer: { paddingHorizontal: 20, paddingTop: FOOTER_GAP, borderTopWidth: StyleSheet.hairlineWidth },
});
