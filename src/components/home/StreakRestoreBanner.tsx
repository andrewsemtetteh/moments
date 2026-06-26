import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedStreakFire } from '@/components/home/AnimatedStreakFire';
import { Icon } from '@/components/ui/Icon';
import { Radius } from '@/constants/design-system';
import { useRestoreStreak } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useTheme } from '@/hooks/useTheme';
import { isStreakRestoreAvailable, streakCountLabel } from '@/lib/streak';
import { STREAK_COLORS } from '@/lib/streak-colors';
import type { StreakStatus } from '@/types/database';

const RESTORE_FIRE_SIZE = 40;

interface StreakRestoreBannerProps {
  status: StreakStatus;
}

export function StreakRestoreBanner({ status }: StreakRestoreBannerProps) {
  const { colors } = useTheme();
  const { isPlus, requirePlus } = usePlusGate();
  const restoreStreak = useRestoreStreak();

  if (!isStreakRestoreAvailable(status)) {
    return null;
  }

  const count = status.restorable_streak;
  const countLabel = streakCountLabel(count);
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
        {
          backgroundColor: colors.surface,
          borderColor: colors.accent,
        },
      ]}>
      <View style={styles.header}>
        <View style={styles.fireWrap}>
          <AnimatedStreakFire
            color={STREAK_COLORS.flame}
            size={RESTORE_FIRE_SIZE}
            animate
            pulse
          />
        </View>

        <View style={styles.headerCopy}>
          <Text style={[styles.countLabel, { color: colors.text }]}>{countLabel}</Text>
          <Text style={[styles.endedTitle, { color: colors.textSecondary }]}>Streak ended</Text>
        </View>

        <View style={[styles.endedPill, { backgroundColor: colors.accentMuted }]}>
          <Text style={[styles.endedPillText, { color: colors.accent }]}>Paused</Text>
        </View>
      </View>

      <Text style={[styles.body, { color: colors.textSecondary }]}>
        {isPlus
          ? 'Bring it back before you send a new moment or message. Any new activity starts a fresh streak.'
          : 'Moments Plus lets you restore this streak once before you both start over.'}
      </Text>

      <Pressable
        onPress={handleRestore}
        disabled={pending}
        style={({ pressed }) => [
          styles.cta,
          {
            backgroundColor: isPlus ? colors.accent : colors.surfaceElevated,
            borderColor: isPlus ? colors.accent : colors.border,
            opacity: pressed || pending ? 0.88 : 1,
          },
        ]}>
        {pending ? (
          <ActivityIndicator size="small" color={isPlus ? colors.onAccent : colors.accent} />
        ) : (
          <>
            <Icon
              name={isPlus ? 'restore' : 'lock'}
              size={17}
              color={isPlus ? colors.onAccent : colors.accent}
              filled={isPlus}
            />
            <Text style={[styles.ctaText, { color: isPlus ? colors.onAccent : colors.accent }]}>
              {isPlus ? 'Restore streak' : 'Restore with Plus'}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  fireWrap: {
    width: RESTORE_FIRE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, gap: 2, justifyContent: 'center', minHeight: RESTORE_FIRE_SIZE },
  countLabel: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 21,
  },
  endedTitle: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  endedPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  endedPillText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '800',
  },
});
