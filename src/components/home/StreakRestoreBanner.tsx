import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedStreakFire } from '@/components/home/AnimatedStreakFire';
import { Icon } from '@/components/ui/Icon';
import { Radius } from '@/constants/design-system';
import { useRestoreStreak } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useTheme } from '@/hooks/useTheme';
import { isStreakRestoreAvailable } from '@/lib/streak';
import { STREAK_COLORS, streakWellColors } from '@/lib/streak-colors';
import type { StreakStatus } from '@/types/database';

interface StreakRestoreBannerProps {
  status: StreakStatus;
}

export function StreakRestoreBanner({ status }: StreakRestoreBannerProps) {
  const { colors } = useTheme();
  const { isPlus, requirePlus } = usePlusGate();
  const restoreStreak = useRestoreStreak();
  const well = streakWellColors('lost', colors);

  if (!isStreakRestoreAvailable(status)) {
    return null;
  }

  const count = status.restorable_streak ?? 0;
  const pending = restoreStreak.isPending;

  const handleRestore = () => {
    if (pending) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isPlus) {
      restoreStreak.mutate();
      return;
    }
    requirePlus('Streak restore');
  };

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}>
      <View style={styles.row}>
        <View style={[styles.flameWell, { backgroundColor: well.well }]}>
          <AnimatedStreakFire color={STREAK_COLORS.lost} size={22} animate={false} />
        </View>

        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            Restore {count}-day streak
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
            {isPlus ? 'Available for a limited time' : 'With Moments Plus'}
          </Text>
        </View>

        <Pressable
          onPress={handleRestore}
          disabled={pending}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: isPlus ? STREAK_COLORS.active : colors.surfaceElevated,
              borderColor: isPlus ? STREAK_COLORS.active : colors.border,
              opacity: pressed || pending ? 0.88 : 1,
            },
          ]}>
          {pending ? (
            <ActivityIndicator size="small" color={isPlus ? STREAK_COLORS.onActive : colors.text} />
          ) : (
            <>
              <Icon
                name="restore"
                size={15}
                color={isPlus ? STREAK_COLORS.onActive : colors.text}
                filled
              />
              <Text
                style={[styles.ctaText, { color: isPlus ? STREAK_COLORS.onActive : colors.text }]}
                numberOfLines={1}>
                Restore
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  flameWell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 12,
    fontWeight: '600',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
    minHeight: 40,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
