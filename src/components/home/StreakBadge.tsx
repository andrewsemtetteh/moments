import { StyleSheet, Text, View } from 'react-native';

import { AnimatedStreakFire } from '@/components/home/AnimatedStreakFire';
import { useTheme } from '@/hooks/useTheme';
import { streakCountLabel, streakSubtitle } from '@/lib/streak';
import { streakFireColor } from '@/lib/streak-colors';
import { isStreakVisuallyAtRisk } from '@/lib/streak-reminder-timing';
import type { StreakStatus } from '@/types/database';

interface StreakBadgeProps {
  status: StreakStatus;
}

export function StreakBadge({ status }: StreakBadgeProps) {
  const { colors } = useTheme();
  const atRisk = isStreakVisuallyAtRisk(status);
  const active = status.current_streak > 0;
  const fireColor = streakFireColor(active || atRisk, atRisk, colors.textTertiary);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: atRisk ? colors.warning : colors.border,
          borderWidth: atRisk ? 1.5 : StyleSheet.hairlineWidth,
        },
      ]}>
      <AnimatedStreakFire
        color={fireColor}
        size={26}
        animate={active}
        pulse={atRisk}
      />
      <View style={styles.text}>
        <Text style={[styles.count, { color: colors.text }]}>
          {active ? streakCountLabel(status.current_streak) : 'No active streak'}
        </Text>
        <Text style={[styles.best, { color: atRisk ? colors.warning : colors.textSecondary }]}>
          {streakSubtitle(status)}
        </Text>
      </View>
      {status.both_active_today && active ? (
        <View style={[styles.bothPill, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.bothText, { color: colors.success }]}>Both ✓</Text>
        </View>
      ) : null}
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
  },
  text: { flex: 1 },
  count: { fontSize: 18, fontWeight: '800' },
  best: { fontSize: 13, marginTop: 2 },
  bothPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  bothText: { fontSize: 11, fontWeight: '800' },
});
