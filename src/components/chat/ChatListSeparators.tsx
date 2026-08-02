import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export function ChatDateSeparator({ label }: { label: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={[styles.pill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      </View>
    </View>
  );
}

export function ChatUnreadDivider({ count }: { count: number }) {
  const { colors } = useTheme();
  const label =
    count <= 0
      ? 'UNREAD'
      : count === 1
        ? '1 UNREAD MESSAGE'
        : `${count} UNREAD MESSAGES`;

  return (
    <View style={styles.unreadWrap}>
      <View style={[styles.unreadLine, { backgroundColor: colors.accent }]} />
      <View style={[styles.unreadPill, { backgroundColor: colors.accentSoft }]}>
        <Text style={[styles.unreadText, { color: colors.accent }]}>{label}</Text>
      </View>
      <View style={[styles.unreadLine, { backgroundColor: colors.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', marginVertical: 14 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { fontSize: 12, fontWeight: '600' },
  unreadWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 16,
    paddingHorizontal: 8,
  },
  unreadLine: { flex: 1, height: 1, opacity: 0.35 },
  unreadPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  unreadText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
});
