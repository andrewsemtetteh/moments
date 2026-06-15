import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

interface StreakBadgeProps {
  count: number;
  longest?: number;
}

export function StreakBadge({ count, longest }: StreakBadgeProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.fireWrap, { backgroundColor: colors.accentSoft }]}>
        <Icon name="fire" size={26} color={colors.accent} filled strokeWidth={1.6} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.count, { color: colors.text }]}>{count} day streak</Text>
        <Text style={[styles.best, { color: colors.textSecondary }]}>
          {longest !== undefined && longest > count ? `Best: ${longest} days` : 'Keep it going together'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  fireWrap: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1 },
  count: { fontSize: 18, fontWeight: '800' },
  best: { fontSize: 13, marginTop: 2 },
});
