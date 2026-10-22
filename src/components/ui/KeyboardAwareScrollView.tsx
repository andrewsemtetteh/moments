import { useCallback, useEffect, useRef, useState, type Ref } from 'react';
import { useScrollWhenNeeded } from '@/hooks/useScrollWhenNeeded';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';

/** Fields that just got focus (see ThemedTextInput), so a field tapped while the keyboard is up is revealed too. */
const focusListeners = new Set<() => void>();
export function notifyInputFocused() {
  for (const listener of focusListeners) listener();
}
/** Hear about a field getting focus; returns the unsubscribe. */
export function subscribeInputFocused(listener: () => void) {
  focusListeners.add(listener);
  return () => {
    focusListeners.delete(listener);
  };
}

/**
 * A form's ScrollView that keeps the field being typed in above the keyboard: when the keyboard
 * opens (or another field is tapped while it's up), it scrolls just enough to show the field with
 * a little room under it. On iPhone it also adds the keyboard's height at the end of the content,
 * so the last fields can scroll up (the page itself isn't resized there).
 */
export function KeyboardAwareScrollView({
  children,
  onScroll,
  onLayout,
  onContentSizeChange,
  gap = 24,
  addKeyboardSpace = true,
  bottomSpace,
  ref,
  ...props
}: ScrollViewProps & {
  /** Space kept between the field and the keyboard. */
  gap?: number;
  /** iPhone: pad the end by the keyboard (off when the page already shrinks above it). */
  addKeyboardSpace?: boolean;
  /** Room after the last field (default: above the home indicator, plus a little). */
  bottomSpace?: number;
  ref?: Ref<ScrollView>;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const offsetY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  // Still when the form fits; scrolls once it doesn't (the keyboard's room counts).
  const fit = useScrollWhenNeeded();
  const insets = useSafeAreaInsets();
  const endSpace = bottomSpace ?? insets.bottom + 24;

  const setRefs = (node: ScrollView | null) => {
    scrollRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as { current: ScrollView | null }).current = node;
  };

  const reveal = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput?.();
    const top = keyboardTop.current;
    if (!input || top == null) return;
    input.measureInWindow((_x, y, _w, h) => {
      const overlap = y + h + gap - top;
      if (overlap > 0) scrollRef.current?.scrollTo({ y: offsetY.current + overlap, animated: true });
    });
  }, [gap]);

  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (ms: number) => timers.push(setTimeout(reveal, ms));
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
      keyboardTop.current = e.endCoordinates.screenY;
      setKeyboardHeight(e.endCoordinates.height);
      // After the keyboard (and any resize of the page) has settled; once more a little later,
      // as Android resizes the page after the keyboard is up.
      later(ios ? 320 : 120);
      later(ios ? 600 : 380);
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardTop.current = null;
      setKeyboardHeight(0);
    });
    const onFocus = () => {
      if (keyboardTop.current != null) {
        later(60);
        later(260);
      }
    };
    focusListeners.add(onFocus);
    return () => {
      show.remove();
      hide.remove();
      focusListeners.delete(onFocus);
      timers.forEach(clearTimeout);
    };
  }, [reveal]);

  return (
    <ScrollView
      ref={setRefs}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      scrollEnabled={fit.scrollEnabled}
      bounces={fit.bounces}
      alwaysBounceVertical={false}
      overScrollMode={fit.overScrollMode}
      {...props}
      // Fills the page, so a tap on the empty space under a short form still closes the keyboard.
      contentContainerStyle={[styles.grow, props.contentContainerStyle]}
      onLayout={(e) => {
        fit.onLayout(e);
        onLayout?.(e);
      }}
      onContentSizeChange={(w, h) => {
        fit.onContentSizeChange(w, h);
        onContentSizeChange?.(w, h);
      }}
      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        offsetY.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}>
      {/* Behind everything: a tap on empty space closes the keyboard (fields and buttons are on top). */}
      <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} accessible={false} />
      {children}
      {/* The last fields clear the home indicator (and any footer), so they can always be reached. */}
      <View style={{ height: endSpace }} />
      {Platform.OS === 'ios' && addKeyboardSpace && keyboardHeight > 0 ? <View style={{ height: keyboardHeight }} /> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  grow: { flexGrow: 1 },
});
