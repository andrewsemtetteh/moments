import { useCallback, useEffect, useRef, useState, type Ref } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
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

/**
 * A form's ScrollView that keeps the field being typed in above the keyboard: when the keyboard
 * opens (or another field is tapped while it's up), it scrolls just enough to show the field with
 * a little room under it. On iPhone it also adds the keyboard's height at the end of the content,
 * so the last fields can scroll up (the page itself isn't resized there).
 */
export function KeyboardAwareScrollView({
  children,
  onScroll,
  gap = 24,
  addKeyboardSpace = true,
  ref,
  ...props
}: ScrollViewProps & {
  /** Space kept between the field and the keyboard. */
  gap?: number;
  /** iPhone: pad the end by the keyboard (off when the page already shrinks above it). */
  addKeyboardSpace?: boolean;
  ref?: Ref<ScrollView>;
}) {
  const scrollRef = useRef<ScrollView | null>(null);
  const offsetY = useRef(0);
  const keyboardTop = useRef<number | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

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
      // After the keyboard (and any resize of the page) has settled.
      later(ios ? 320 : 80);
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      keyboardTop.current = null;
      setKeyboardHeight(0);
    });
    const onFocus = () => {
      if (keyboardTop.current != null) later(60);
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
      {...props}
      onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
        offsetY.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}>
      {children}
      {Platform.OS === 'ios' && addKeyboardSpace && keyboardHeight > 0 ? <View style={{ height: keyboardHeight }} /> : null}
    </ScrollView>
  );
}
