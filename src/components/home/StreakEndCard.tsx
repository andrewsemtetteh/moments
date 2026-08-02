import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedStreakFire } from '@/components/home/AnimatedStreakFire';
import { Icon } from '@/components/ui/Icon';
import { Radius } from '@/constants/design-system';
import { useRestoreStreak } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useTheme } from '@/hooks/useTheme';
import { getStreakEndVariant, shouldShowStreakEndCard, streakEndLine, withEffectiveStreakRestore } from '@/lib/streak';
import { STREAK_COLORS } from '@/lib/streak-colors';
import type { StreakStatus } from '@/types/database';

const FIRE_SIZE = 28;

interface StreakEndCardProps {
  status: StreakStatus;
}

function streakEndDismissKey(status: StreakStatus): string {
  return [
    status.can_restore_streak,
    status.restorable_streak,
    status.restorable_lost_at,
    status.at_risk,
    status.current_streak,
    status.longest_streak,
  ].join(':');
}

export function StreakEndCard({ status }: StreakEndCardProps) {
  const { colors } = useTheme();
  const { isPlus, requirePlus } = usePlusGate();
  const restoreStreak = useRestoreStreak();
  const effectiveStatus = useMemo(() => withEffectiveStreakRestore(status), [status]);
  const dismissKey = useMemo(() => streakEndDismissKey(effectiveStatus), [effectiveStatus]);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  useEffect(() => {
    setDismissedKey(null);
  }, [dismissKey]);

  const variant = getStreakEndVariant(effectiveStatus);
  if (!variant || !shouldShowStreakEndCard(effectiveStatus) || dismissedKey === dismissKey) return null;

  const pending = restoreStreak.isPending;
  const fireColor =
    variant === 'at-risk'
      ? STREAK_COLORS.atRiskBright
      : variant === 'restore'
        ? STREAK_COLORS.flame
        : colors.textTertiary;

  const handleRestore = () => {
    if (pending) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isPlus) {
      restoreStreak.mutate();
      return;
    }
    requirePlus('Streak restore');
  };

  const handleDismiss = () => {
    void Haptics.selectionAsync();
    setDismissedKey(dismissKey);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: variant === 'at-risk' ? STREAK_COLORS.atRiskBright : colors.border,
          backgroundColor:
            variant === 'at-risk'
              ? colors.isDark
                ? STREAK_COLORS.atRiskSoftDark
                : STREAK_COLORS.atRiskSoftLight
              : colors.surface,
        },
      ]}>
      <Pressable
        onPress={handleDismiss}
        hitSlop={10}
        style={styles.closeBtn}
        accessibilityRole="button"
        accessibilityLabel="Dismiss">
        <Icon name="close" size={16} color={colors.textTertiary} />
      </Pressable>

      <View style={styles.row}>
        <AnimatedStreakFire
          color={fireColor}
          size={FIRE_SIZE}
          animate
          pulse={variant === 'at-risk'}
        />
        <Text style={[styles.line, { color: colors.text }]}>{streakEndLine(effectiveStatus, variant)}</Text>
      </View>

      {variant === 'restore' ? (
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
                name={isPlus ? 'rewind' : 'lock'}
                size={15}
                color={isPlus ? colors.onAccent : colors.accent}
                filled={isPlus}
              />
              <Text style={[styles.ctaText, { color: isPlus ? colors.onAccent : colors.accent }]}>
                Restore
              </Text>
            </>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    paddingTop: 10,
    gap: 10,
  },
  closeBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 1,
    padding: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 22,
  },
  line: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 40,
  },
  ctaText: {
    fontSize: 14,
    fontWeight: '800',
  },
});
