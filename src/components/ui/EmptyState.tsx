import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

/**
 * Centered icon (or `art`, e.g. an onboarding character), title and one line of help. Pass `fill` to
 * center it in the remaining screen space. On Default the icon is a butter sticker.
 */
export function EmptyState({
  icon,
  art,
  title,
  text,
  action,
  fill,
  style,
}: {
  icon: IconName;
  /** Replaces the icon badge (e.g. an onboarding character). */
  art?: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, fill && styles.fill, style]}>
      {art ?? (
        <View
          style={[
            styles.icon,
            colors.sticker
              ? { backgroundColor: colors.lit, borderWidth: 2, borderColor: STICKER_INK }
              : { backgroundColor: colors.accentSoft },
          ]}>
          <Icon name={icon} size={30} color={colors.sticker ? STICKER_INK : colors.accent} />
        </View>
      )}
      <Text style={[styles.title, colors.sticker && styles.stickerTitle, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>
      {text ? <Text style={[styles.text, { color: colors.textSecondary }]}>{text}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

/** The butter badge is light in dark mode too, so its outline and icon stay ink. */
const STICKER_INK = '#1A1A1A';

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, paddingHorizontal: 32, paddingVertical: 40 },
  fill: { flex: 1, justifyContent: 'center' },
  icon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  stickerTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  text: { fontSize: 15, fontWeight: '500', lineHeight: 21, textAlign: 'center' },
  action: { marginTop: 10 },
});
