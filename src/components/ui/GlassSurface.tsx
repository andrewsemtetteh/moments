import { BlurView } from 'expo-blur';
import { ReactNode } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  borderRadius?: number;
};

export function GlassSurface({ children, style, intensity, borderRadius = Radius.lg }: Props) {
  const { colors } = useTheme();
  const blurIntensity = intensity ?? (colors.isDark ? 48 : 72);

  if (!colors.glass || Platform.OS === 'web') {
    return (
      <View
        style={[
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius,
            overflow: 'hidden',
          },
          style,
        ]}>
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.shell, { borderColor: colors.borderStrong, borderRadius }, style]}>
      <BlurView intensity={blurIntensity} tint={colors.isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.surfaceGlass, borderRadius }]}
      />
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  content: { position: 'relative' },
});
