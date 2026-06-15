import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTabBarInset } from '@/hooks/useTabBarInset';

type Props = ScrollViewProps & {
  children: ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

/** Tab screen scroll with a real bottom spacer so the last item never sits under the tab bar. */
export function TabScreenScroll({ children, contentContainerStyle, style, ...scrollProps }: Props) {
  const tabBarInset = useTabBarInset();

  return (
    <ScrollView
      {...scrollProps}
      style={[styles.flex, style]}
      contentContainerStyle={[contentContainerStyle, styles.content]}>
      {children}
      <View style={{ height: tabBarInset }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1 },
});
