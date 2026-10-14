import { ReactNode, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useTabBarInset } from '@/hooks/useTabBarInset';

type Props = ScrollViewProps & {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  ref?: Ref<ScrollView>;
};

/** Room left between a focused field and the top of the keyboard. */
const FIELD_GAP = 24;

/**
 * Tab screen scroll whose bottom padding clears the floating tab bar, so the
 * last item never sits under it. It replaces the screen's own paddingBottom
 * (it used to be a spacer view, which also picked up the screen's `gap` and
 * left a much bigger empty area than intended).
 *
 * Typing in a field on the page (today's question, for one) keeps it above the
 * keyboard: iOS insets and scrolls natively; Android gets the keyboard's height
 * as extra room and a scroll to the focused field.
 */
export function TabScreenScroll({ children, contentContainerStyle, style, ref, ...scrollProps }: Props) {
  const tabBarInset = useTabBarInset();
  const scrollRef = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => scrollRef.current as ScrollView);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const offsetY = useRef(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      const height = e.endCoordinates.height;
      setKeyboardHeight(height);
      // Bring the focused field into view, just above the keyboard.
      const field = TextInput.State.currentlyFocusedInput();
      if (!field) return;
      requestAnimationFrame(() => {
        field.measureInWindow((_x, y, _w, h) => {
          const visibleBottom = e.endCoordinates.screenY - FIELD_GAP;
          const overlap = y + h - visibleBottom;
          if (overlap > 0) scrollRef.current?.scrollTo({ y: offsetY.current + overlap, animated: true });
        });
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      {...scrollProps}
      onScroll={(e) => {
        offsetY.current = e.nativeEvent.contentOffset.y;
        scrollProps.onScroll?.(e);
      }}
      style={[styles.flex, style]}
      contentContainerStyle={[
        contentContainerStyle,
        styles.content,
        // While typing, the keyboard (not the tab bar) is what sits at the bottom.
        { paddingBottom: keyboardHeight > 0 ? keyboardHeight + FIELD_GAP : tabBarInset },
      ]}
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}>
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
});
