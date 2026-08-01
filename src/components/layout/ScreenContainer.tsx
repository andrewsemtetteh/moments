import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassBackdrop } from '@/components/layout/GlassBackdrop';
import { TabSwipeView } from '@/components/layout/TabSwipeView';
import { useTheme } from '@/hooks/useTheme';

interface ScreenContainerProps {
  children: ReactNode;
  padded?: boolean;
  gradient?: boolean;
  /** Enable left/right swipes to change tabs (and open chat from home). */
  tabSwipe?: boolean;
}

/** Space reserved at the bottom of scroll views so content clears the floating tab bar. */
export const TAB_BAR_SPACE = 110;

export function ScreenContainer({
  children,
  padded = true,
  gradient = true,
  tabSwipe = false,
}: ScreenContainerProps) {
  const { colors } = useTheme();
  const paddingStyle = { paddingHorizontal: padded ? 16 : 0 };
  const body = tabSwipe ? <TabSwipeView>{children}</TabSwipeView> : children;

  if (colors.glass && gradient) {
    return (
      <GlassBackdrop>
        <View style={[styles.container, paddingStyle]}>{body}</View>
      </GlassBackdrop>
    );
  }

  if (gradient) {
    return (
      <LinearGradient
        colors={colors.gradientHero}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.container, paddingStyle]}>
        {body}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, paddingStyle]}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
