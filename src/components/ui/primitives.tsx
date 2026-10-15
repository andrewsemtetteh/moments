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
import { Radius, Spacing, type ThemeColors, type Tint } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { getAvatarInitial } from '@/lib/avatar-initial';

export function Card({
  children,
  style,
  onPress,
  glassy = false,
  padded = true,
  tint,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  glassy?: boolean;
  padded?: boolean;
  /** Pastel fill on Default (the part of the app this card belongs to); plain surface on other themes. */
  tint?: Tint;
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
    backgroundColor: tint ? colors.tints[tint] : colors.surface,
    borderColor: colors.border,
    borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
    borderRadius: colors.sticker ? STICKER_RADIUS : Radius.lg,
    padding,
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          base,
          style,
          pressed && (colors.sticker ? styles.stickerPressed : { opacity: 0.85, transform: [{ scale: 0.99 }] }),
        ]}>
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
      style={[
        { borderRadius: colors.sticker ? STICKER_RADIUS : Radius.lg, padding: 18 },
        colors.sticker && colors.boldBorder && { borderWidth: 2, borderColor: colors.border },
        style,
      ]}>
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
  style,
}: {
  children: ReactNode;
  action?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectionRow, style]}>
      <Text
        style={colors.sticker ? [styles.stickerSectionTitle, { color: colors.text }] : [styles.sectionTitle, { color: colors.textSecondary }]}
        accessibilityRole="header">
        {children}
      </Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={12} accessibilityRole="button">
          <Text
            style={[
              styles.sectionAction,
              { color: colors.sticker ? colors.highlightText : colors.accent },
              colors.sticker && styles.stickerSectionAction,
            ]}>
            {action}
          </Text>
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
      const textColor = initialColor ?? (isWhiteBackground ? colors.accent : colors.onGradient);

      return (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ ...avatarStyle, alignItems: 'center', justifyContent: 'center' }}>
          <Text
            style={{
              color: textColor,
              fontSize: Math.round(size * 0.58),
              lineHeight: Math.round(size * 0.62),
              fontWeight: '700',
              textAlign: 'center',
              includeFontPadding: false,
            }}>
            {initial}
          </Text>
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
          backgroundColor: active ? colors.accent : colors.sticker ? colors.surface : colors.surfaceElevated,
          borderColor: active ? colors.accent : colors.border,
          borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
        },
        colors.sticker && styles.stickerChip,
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!active } : undefined}>
      {icon}
      <Text
        style={{
          color: active ? colors.onAccent : colors.sticker ? colors.text : colors.textSecondary,
          fontSize: colors.sticker ? 14 : 13,
          fontWeight: colors.sticker ? '800' : '600',
        }}>
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
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      style={({ pressed }) => [
        styles.primaryBtn,
        {
          backgroundColor: colors.accent,
          opacity: disabled ? 0.45 : pressed ? 0.9 : 1,
          borderWidth: colors.boldBorder && !colors.sticker ? 2 : 0,
          borderColor: colors.text,
        },
        colors.sticker && styles.stickerBtn,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.onAccent} />
      ) : (
        <Text style={[styles.primaryBtnText, colors.sticker && styles.stickerBtnText, { color: colors.onAccent }, textStyle]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function StatPill({ value, label }: { value: string | number; label: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.statPill,
        {
          backgroundColor: colors.sticker ? colors.surface : colors.surfaceElevated,
          borderColor: colors.border,
          borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
        },
        colors.sticker && styles.stickerStatPill,
      ]}>
      <Text style={[styles.statValue, colors.sticker && styles.stickerStatValue, { color: colors.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

/**
 * Paper's outline for panels drawn in the card colour (white on a white page there). Nothing on themes
 * without outlines.
 */
export function paperEdge(colors: ThemeColors, width = 2): ViewStyle | null {
  return colors.boldBorder ? { borderWidth: width, borderColor: colors.border } : null;
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

/** Cards on Default: the 22pt corners of the streak and Wrapped stickers. */
const STICKER_RADIUS = 22;

const styles = StyleSheet.create({
  stickerPressed: { transform: [{ scale: 0.98 }] },
  stickerSectionTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4 },
  stickerSectionAction: { fontSize: 15, fontWeight: '800' },
  stickerChip: { paddingHorizontal: 16, minHeight: 40, borderRadius: Radius.pill },
  stickerBtn: { minHeight: 56, borderRadius: 28, paddingVertical: 0 },
  stickerBtnText: { fontSize: 17, fontWeight: '800' },
  stickerStatPill: { borderRadius: 20, paddingVertical: 16 },
  stickerStatValue: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  flex: { flex: 1 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
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
  statLabel: { fontSize: 11, marginTop: 2, },
});
