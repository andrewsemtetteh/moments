import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useRestoreStreak } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useTheme } from '@/hooks/useTheme';
import { streakCountLabel } from '@/lib/streak';
import type { StreakStatus } from '@/types/database';

interface StreakRestoreBannerProps {
  status: StreakStatus;
}

export function StreakRestoreBanner({ status }: StreakRestoreBannerProps) {
  const { colors } = useTheme();
  const { isPlus, requirePlus } = usePlusGate();
  const restoreStreak = useRestoreStreak();

  if (!status.can_restore_streak || !status.restorable_streak) {
    return null;
  }

  const count = status.restorable_streak;
  const countLabel = streakCountLabel(count);

  const handleRestore = () => {
    if (restoreStreak.isPending) return;

    if (isPlus) {
      restoreStreak.mutate();
      return;
    }

    requirePlus('Streak restore');
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surface,
          borderColor: colors.accent,
        },
      ]}>
      <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
        <Icon name="fire" size={22} color={colors.accent} filled />
      </View>

      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]}>{countLabel} ended</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {isPlus
            ? 'Restore it before you start a new streak — any new activity locks this in.'
            : 'Plus members can restore it once before starting over.'}
        </Text>
      </View>

      <Pressable
        onPress={handleRestore}
        disabled={restoreStreak.isPending}
        style={({ pressed }) => [
          styles.button,
          {
            backgroundColor: isPlus ? colors.accent : colors.surfaceElevated,
            borderColor: isPlus ? colors.accent : colors.border,
            opacity: pressed || restoreStreak.isPending ? 0.85 : 1,
          },
        ]}>
        {restoreStreak.isPending ? (
          <ActivityIndicator size="small" color={isPlus ? colors.onAccent : colors.text} />
        ) : (
          <>
            {!isPlus ? <Icon name="plus" size={14} color={colors.accent} /> : null}
            <Text
              style={[
                styles.buttonText,
                { color: isPlus ? colors.onAccent : colors.accent },
              ]}>
              {isPlus ? 'Restore' : 'Restore with Plus'}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 15, fontWeight: '800' },
  subtitle: { fontSize: 12, lineHeight: 17 },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 92,
    justifyContent: 'center',
  },
  buttonText: { fontSize: 13, fontWeight: '800' },
});
