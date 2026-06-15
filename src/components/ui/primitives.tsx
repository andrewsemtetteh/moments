import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import {
    ActivityIndicator,
    Pressable,
    StyleSheet,
    Text,
    View,
    type StyleProp,
    type TextStyle,
    type ViewStyle,
} from 'react-native';

import { GlassSurface } from '@/components/ui/GlassSurface';
import { Radius, type ThemeColors } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { getAvatarInitial } from '@/lib/avatar-initial';

export function Card({
  children,
  style,
  onPress,
  glassy = false,
  padded = true,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  glassy?: boolean;
  padded?: boolean;
}) {
  const { colors } = useTheme();
  const useGlass = colors.glass || glassy;
  const padding = padded ? 16 : 0;

  if (useGlass) {
    const inner = <View style={{ padding }}>{children}</View>;
    if (onPress) {
      return (
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [style, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
          <GlassSurface>{inner}</GlassSurface>
        </Pressable>
      );
    }
    return <GlassSurface style={style}>{inner}</GlassSurface>;
  }

  const base: ViewStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [base, style, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function GradientCard({
  children,
  colorsOverride,
  style,
  onPress,
}: {
  children: ReactNode;
  colorsOverride?: [string, string];
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const gradColors = colorsOverride ?? colors.gradient;

  const inner = (
    <LinearGradient
      colors={gradColors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[{ borderRadius: Radius.lg, padding: 18 }, style]}>
      {children}
    </LinearGradient>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.9 }}>
        {inner}
      </Pressable>
    );
  }
  return inner;
}

export function ScreenBackground({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <LinearGradient colors={colors.gradientHero} style={styles.flex} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
      {children}
    </LinearGradient>
  );
}

export function SectionTitle({
  children,
  action,
  onAction,
}: {
  children: ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{children}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[styles.sectionAction, { color: colors.accent }]}>{action}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function Avatar({
  name,
  imageUrl,
  size = 44,
  colorsOverride,
  initialColor,
  onPress,
}: {
  name?: string | null;
  imageUrl?: string | null;
  size?: number;
  colorsOverride?: [string, string];
  /** Text color for the initial fallback. Defaults to accent on white backgrounds. */
  initialColor?: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const initial = getAvatarInitial(name);
  const resolvedImageUrl = imageUrl?.trim() || null;

  const avatarStyle = { width: size, height: size, borderRadius: size / 2 };

  const content = resolvedImageUrl ? (
    <Image
      source={{ uri: resolvedImageUrl }}
      style={avatarStyle}
      contentFit="cover"
    />
  ) : (
    (() => {
      const gradientColors = colorsOverride ?? colors.gradient;
      const isWhiteBackground = gradientColors.every((c) => {
        const normalized = c.trim().toLowerCase();
        return normalized === '#fff' || normalized === '#ffffff' || normalized === 'white';
      });
      const textColor = initialColor ?? (isWhiteBackground ? colors.accent : '#fff');

      return (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ ...avatarStyle, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: textColor, fontSize: size * 0.4, fontWeight: '700' }}>{initial}</Text>
        </LinearGradient>
      );
    })()
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        hitSlop={4}
        accessibilityRole="button"
        style={({ pressed }) => pressed && { opacity: 0.85 }}>
        {content}
      </Pressable>
    );
  }

  return content;
}

export function Chip({
  label,
  active,
  onPress,
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  icon?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.accent : colors.surfaceElevated,
          borderColor: active ? colors.accent : colors.border,
        },
      ]}>
      {icon}
      <Text style={{ color: active ? colors.onAccent : colors.textSecondary, fontSize: 13, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  style,
  textStyle,
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primaryBtn,
        { backgroundColor: colors.accent, opacity: disabled ? 0.45 : pressed ? 0.9 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <Text style={[styles.primaryBtnText, { color: colors.onAccent }, textStyle]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function StatPill({ value, label }: { value: string | number; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.statPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

export function colorWithAlpha(hex: string, alpha: number) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export type { ThemeColors };

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionAction: { fontSize: 13, fontWeight: '600' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  primaryBtn: {
    paddingVertical: 16,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700' },
  statPill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.5 },
});
