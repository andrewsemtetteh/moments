import { ReactNode, type Ref } from 'react';
import { ScrollView, StyleSheet, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTabBarInset } from '@/hooks/useTabBarInset';

type Props = ScrollViewProps & {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  ref?: Ref<ScrollView>;
};

/**
 * Tab screen scroll whose bottom padding clears the floating tab bar, so the
 * last item never sits under it. It replaces the screen's own paddingBottom
 * (it used to be a spacer view, which also picked up the screen's `gap` and
 * left a much bigger empty area than intended).
 */
export function TabScreenScroll({ children, contentContainerStyle, style, ref, ...scrollProps }: Props) {
  const tabBarInset = useTabBarInset();

  return (
    <ScrollView
      ref={ref}
      {...scrollProps}
      style={[styles.flex, style]}
      contentContainerStyle={[contentContainerStyle, styles.content, { paddingBottom: tabBarInset }]}
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
