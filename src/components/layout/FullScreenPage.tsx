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
  dismissKeyboardOnTap = true,
  children,
}: {
  visible: boolean;
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
   * Tap empty space to close the keyboard (forms). Pages without fields turn it
   * off: the catcher can swallow a scroll view's drags.
   */
  dismissKeyboardOnTap?: boolean;
  children: ReactNode;
}) {
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

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onBack}>
      <ThemedStatusBar />
      <GestureHandlerRootView style={styles.flex}>
        <GestureDetector gesture={swipeBack}>
          <Animated.View style={[styles.flex, { backgroundColor: colors.background }, pageStyle]}>
            {/* Tapping anywhere that isn't a field or a button — header included —
                closes the keyboard. */}
            {dismissKeyboardOnTap ? (
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.flex}>
                  <ScreenHeader title={title} onBack={onBack} right={right} />
                  <KeyboardAvoidingView
                    style={styles.flex}
                    behavior={Platform.OS === 'ios' && avoidKeyboard ? 'padding' : undefined}>
                    {children}
                  </KeyboardAvoidingView>
                </View>
              </TouchableWithoutFeedback>
            ) : (
              <View style={styles.flex}>
                <ScreenHeader title={title} onBack={onBack} right={right} />
                <KeyboardAvoidingView
                  style={styles.flex}
                  behavior={Platform.OS === 'ios' && avoidKeyboard ? 'padding' : undefined}>
                  {children}
                </KeyboardAvoidingView>
              </View>
            )}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
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
  flex: { flex: 1 },
  footer: { paddingHorizontal: 20, paddingTop: FOOTER_GAP, borderTopWidth: StyleSheet.hairlineWidth },
});
