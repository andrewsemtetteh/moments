import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { insetCardStyle } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';

/**
 * A drawer's top, as on the Settings drawers: the title on the left (20pt, heavy), an optional
 * hint under it, and on the right an optional close button and/or an action (e.g. a ✓).
 */
export function SheetHeader({
  title,
  hint,
  onClose,
  right,
}: {
  title: string;
  hint?: string;
  /** Shows a round ✕ on the right. */
  onClose?: () => void;
  /** Anything else on the right, after the ✕ (e.g. a save button). */
  right?: ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {title}
        </Text>
        {hint ? <Text style={[styles.hint, { color: colors.textSecondary }]}>{hint}</Text> : null}
      </View>
      {onClose ? <SheetIconButton icon="close" onPress={onClose} accessibilityLabel="Close" /> : null}
      {right}
    </View>
  );
}

/** The drawers' round buttons: ✕ on an inset card, or a ✓ filled with the theme colour. */
export function SheetIconButton({
  icon,
  onPress,
  accessibilityLabel,
  primary = false,
  disabled = false,
}: {
  icon: 'close' | 'check';
  onPress: () => void;
  accessibilityLabel: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        primary ? { backgroundColor: colors.accent } : insetCardStyle(colors, 'sheet'),
        { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 },
      ]}>
      <Icon name={icon} size={24} color={primary ? colors.onAccent : colors.text} />
    </Pressable>
  );
}

/** A Settings-style inset list on a drawer: rounded, outlined, rows split by separators. */
export function sheetListStyle(colors: Parameters<typeof insetCardStyle>[0]) {
  return [styles.list, insetCardStyle(colors, 'sheet')];
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  copy: { flex: 1, minWidth: 0, paddingTop: 8 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  hint: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  button: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  list: { borderRadius: 18, overflow: 'hidden' },
});
