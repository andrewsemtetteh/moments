import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

/** Centered icon, title and one line of help. Pass `fill` to center it in the remaining screen space. */
export function EmptyState({
  icon,
  title,
  text,
  action,
  fill,
  style,
}: {
  icon: IconName;
  title: string;
  text?: string;
  action?: ReactNode;
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.wrap, fill && styles.fill, style]}>
      <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
        <Icon name={icon} size={30} color={colors.accent} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      {text ? <Text style={[styles.text, { color: colors.textSecondary }]}>{text}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, paddingHorizontal: 32, paddingVertical: 40 },
  fill: { flex: 1, justifyContent: 'center' },
  icon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  text: { fontSize: 15, fontWeight: '500', lineHeight: 21, textAlign: 'center' },
  action: { marginTop: 10 },
});
