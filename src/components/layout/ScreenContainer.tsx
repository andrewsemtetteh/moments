import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { GlassBackdrop } from '@/components/layout/GlassBackdrop';
import { useTheme } from '@/hooks/useTheme';

interface ScreenContainerProps {
  children: ReactNode;
  padded?: boolean;
  gradient?: boolean;
}

/** Space reserved at the bottom of scroll views so content clears the floating tab bar. */
export const TAB_BAR_SPACE = 110;

export function ScreenContainer({ children, padded = true, gradient = true }: ScreenContainerProps) {
  const { colors } = useTheme();
  const paddingStyle = { paddingHorizontal: padded ? 16 : 0 };

  if (colors.glass && gradient) {
    return (
      <GlassBackdrop>
        <View style={[styles.container, paddingStyle]}>{children}</View>
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
        {children}
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, paddingStyle]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
