import { useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View, useWindowDimensions, type ScrollViewProps } from 'react-native';
import { KeyboardEvents } from 'react-native-keyboard-controller';

import { subscribeInputFocused } from '@/components/ui/KeyboardAwareScrollView';

type Props = ScrollViewProps & {
  /** Space kept under the field you're typing in. */
  bottomOffset?: number;
  /** Space kept between the end of the page (its last button) and the keyboard. */
  endGap?: number;
  /** Covered top of the scroll view (a sticky header): the field never scrolls under it. */
  topInset?: number;
};

/**
 * A page that types into a field. As the keyboard starts to open (or another field is tapped
 * while it's up) the page scrolls once, straight to where its end, the last button, sits just
 * above the keyboard. If the page is too tall for that, it scrolls only as far as keeps the field
 * in view under the top. One movement, started with the keyboard, not a scroll to the field and
 * then another to the button.
 */
export function KeyboardFormScrollView({
  bottomOffset = 24,
  endGap = 16,
  topInset = 16,
  onScroll,
  children,
  ...props
}: Props) {
  const scrollRef = useRef<ScrollView | null>(null);
  const offsetY = useRef(0);
  // Marks where the page really ends (before the room added for the keyboard).
  const endRef = useRef<View | null>(null);
  const { height: windowH } = useWindowDimensions();
  // Room at the end while the keyboard is up, so the page can scroll that far.
  const [keyboardH, setKeyboardH] = useState(0);
  const keyboardRef = useRef(0);
  const settle = useRef(0);

  const scrollIntoPlace = () => {
    const scroll = scrollRef.current;
    const input = TextInput.State.currentlyFocusedInput?.();
    const kb = keyboardRef.current;
    if (!scroll || !input || kb <= 0) return;
    const keyboardTop = windowH - kb;
    const end = endRef.current;
    if (!end) return;
    scroll.getNativeScrollRef()?.measureInWindow((_sx, scrollTop) => {
      input.measureInWindow((_ix, inputTop, _iw, inputH) => {
        end.measureInWindow((_ex, contentEnd) => {
          const toEnd = contentEnd + endGap - keyboardTop;
          const toField = inputTop + inputH + bottomOffset - keyboardTop;
          const fieldAtTop = inputTop - (scrollTop + topInset);
          // As far as the end, at least far enough to show the field, never past the field's top.
          const delta = Math.min(Math.max(toField, Math.min(toEnd, fieldAtTop)), fieldAtTop);
          if (delta > 1) scroll.scrollTo({ y: offsetY.current + delta, animated: true });
        });
      });
    });
  };
  const scrollRefFn = useRef(scrollIntoPlace);
  useEffect(() => {
    scrollRefFn.current = scrollIntoPlace;
  });

  useEffect(() => {
    const show = KeyboardEvents.addListener('keyboardWillShow', (e) => {
      keyboardRef.current = e.height;
      setKeyboardH(e.height);
    });
    const hide = KeyboardEvents.addListener('keyboardWillHide', () => {
      keyboardRef.current = 0;
      setKeyboardH(0);
    });
    // Another field tapped while the keyboard is already up.
    const unfocus = subscribeInputFocused(() => {
      if (keyboardRef.current > 0) settle.current = requestAnimationFrame(() => scrollRefFn.current());
    });
    return () => {
      show.remove();
      hide.remove();
      unfocus();
      cancelAnimationFrame(settle.current);
    };
  }, []);

  // Once the room for the keyboard is laid out, the one scroll.
  useEffect(() => {
    if (keyboardH <= 0) return;
    const id = requestAnimationFrame(() => scrollRefFn.current());
    return () => cancelAnimationFrame(id);
  }, [keyboardH]);

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      {...props}
      onScroll={(e) => {
        offsetY.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}>
      {children}
      <View ref={endRef} collapsable={false} />
      {keyboardH > 0 ? <View style={{ height: keyboardH }} /> : null}
    </ScrollView>
  );
}
