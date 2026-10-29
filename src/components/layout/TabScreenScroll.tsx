import { useIsFocused } from 'expo-router';
import { ReactNode, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { useScrollWhenNeeded } from '@/hooks/useScrollWhenNeeded';
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
 * keyboard: the page gets the keyboard's height as extra room and a scroll to the
 * focused field (on both platforms, only for this page's own fields).
 */
export function TabScreenScroll({ children, contentContainerStyle, style, ref, ...scrollProps }: Props) {
  const tabBarInset = useTabBarInset();
  const scrollRef = useRef<ScrollView>(null);
  useImperativeHandle(ref, () => scrollRef.current as ScrollView);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const offsetY = useRef(0);
  // A page whose content fits stays still; it scrolls once it doesn't (the keyboard's room
  // counts). Pull-to-refresh pages keep their drag.
  const fit = useScrollWhenNeeded();
  const fitProps = scrollProps.refreshControl
    ? {}
    : { scrollEnabled: fit.scrollEnabled, bounces: fit.bounces, overScrollMode: fit.overScrollMode };
  // Tab pages stay mounted under Chat, Moments, sheets… and used to make room for those
  // screens' keyboards too. When that keyboard closed elsewhere the room could stay
  // (iOS's automatic insets sometimes never reset; Android could miss the hide), leaving
  // Home with a huge blank area to scroll into. Now only this page's own typing, while
  // it's on screen, makes room, and any leftover is cleared when the page shows again.
  const focused = useIsFocused();
  const focusedRef = useRef(focused);
  const [lastFocused, setLastFocused] = useState(focused);
  if (lastFocused !== focused) {
    setLastFocused(focused);
    setKeyboardHeight(0);
  }
  useEffect(() => {
    focusedRef.current = focused;
  }, [focused]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      if (!focusedRef.current) return;
      const field = TextInput.State.currentlyFocusedInput();
      // The scroll view is a native view: it can measure where it sits on screen.
      const scroll = scrollRef.current as unknown as View | null;
      if (!field || !scroll) return;
      requestAnimationFrame(() => {
        scroll.measureInWindow((_sx, sy, _sw, sh) => {
          field.measureInWindow((_x, y, _w, h) => {
            // Only a field on this page (inside this scroll view on screen).
            if (y + h < sy || y > sy + sh) return;
            setKeyboardHeight(e.endCoordinates.height);
            // Bring it into view, just above the keyboard.
            const visibleBottom = e.endCoordinates.screenY - FIELD_GAP;
            const overlap = y + h - visibleBottom;
            if (overlap > 0) scrollRef.current?.scrollTo({ y: offsetY.current + overlap, animated: true });
          });
        });
      });
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      alwaysBounceVertical={false}
      {...fitProps}
      {...scrollProps}
      onLayout={(e) => {
        fit.onLayout(e);
        scrollProps.onLayout?.(e);
      }}
      onContentSizeChange={(w, h) => {
        fit.onContentSizeChange(w, h);
        scrollProps.onContentSizeChange?.(w, h);
      }}
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
