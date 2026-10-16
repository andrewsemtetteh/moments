import { useEffect, useState, type ReactNode } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { useTheme } from '@/hooks/useTheme';
import { ThemedStatusBar } from '@/components/ui/ThemedStatusBar';

const SCREEN_W = Dimensions.get('window').width;
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
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [mounted, setMounted] = useState(visible);
  const translateX = useSharedValue(SCREEN_W);

  useEffect(() => {
    if (visible) {
      setMounted(true);
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

  const pageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  // iPhone: pad up (or leave it to a scroll view that lifts the focused field itself).
  // Android: this is a pop-up window the system doesn't resize for the keyboard, so
  // always shrink to the space above it, or fields near the bottom end up hidden.
  const keyboardBehavior = Platform.OS === 'android' ? 'height' : avoidKeyboard ? 'padding' : undefined;

  if (!mounted) return null;

  const header = floatingBack ? null : <ScreenHeader title={title} onBack={onBack} right={right} />;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onBack}>
      <ThemedStatusBar style={headerTint ? (isLightColor(headerTint) ? 'light' : 'dark') : undefined} />
      <GestureHandlerRootView style={styles.flex}>
        <GestureDetector gesture={swipeBack}>
          <Animated.View style={[styles.flex, { backgroundColor: colors.background }, pageStyle]}>
            {/* Tapping anywhere that isn't a field or a button — header included —
                closes the keyboard. */}
            {dismissKeyboardOnTap ? (
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.flex}>
                  {header}
                  <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={keyboardBehavior}>
                    {children}
                  </KeyboardAvoidingView>
                </View>
              </TouchableWithoutFeedback>
            ) : (
              <View style={styles.flex}>
                {header}
                <KeyboardAvoidingView
                  style={styles.flex}
                  behavior={keyboardBehavior}>
                  {children}
                </KeyboardAvoidingView>
              </View>
            )}
            {floatingBack ? (
              <View pointerEvents="box-none" style={[styles.floatingBack, { top: insets.top + 6 }]}>
                <HeaderIconButton icon="chevronLeft" onPress={onBack} accessibilityLabel="Go back" chip />
              </View>
            ) : null}
          </Animated.View>
        </GestureDetector>
        {overlay}
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
