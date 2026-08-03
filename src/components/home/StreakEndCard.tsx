import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedStreakFire } from '@/components/home/AnimatedStreakFire';
import { Icon } from '@/components/ui/Icon';
import { Radius } from '@/constants/design-system';
import { useRestoreStreak } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useTheme } from '@/hooks/useTheme';
import {
  getStreakEndVariant,
  shouldShowStreakEndCard,
  streakEndLine,
  withEffectiveStreakRestore,
} from '@/lib/streak';
import { STREAK_COLORS } from '@/lib/streak-colors';
import { isStreakVisuallyAtRisk, msUntilLocalMidnight } from '@/lib/streak-reminders';
import type { StreakStatus } from '@/types/database';

const FIRE_SIZE = 28;

function streakEndsInLabel(ms: number): string {
  const totalMins = Math.max(1, Math.ceil(ms / 60_000));
  if (totalMins < 60) {
    return totalMins === 1 ? 'Streak ends in 1 min' : `Streak ends in ${totalMins} mins`;
  }
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (mins === 0) {
    return hours === 1 ? 'Streak ends in 1 hour' : `Streak ends in ${hours} hours`;
  }
  return hours === 1
    ? `Streak ends in 1 hour ${mins}m`
    : `Streak ends in ${hours} hours ${mins}m`;
}

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
  const [endsInMs, setEndsInMs] = useState(() => msUntilLocalMidnight());
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    setDismissedKey(null);
  }, [dismissKey]);

  const variant = getStreakEndVariant(effectiveStatus);
  const isAtRisk = variant === 'at-risk';
  const showAtRiskCard =
    isAtRisk && isStreakVisuallyAtRisk(effectiveStatus, new Date(nowTick));

  useEffect(() => {
    if (!isAtRisk) return;
    const tick = () => {
      setEndsInMs(msUntilLocalMidnight());
      setNowTick(Date.now());
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [isAtRisk]);

  if (!variant || !shouldShowStreakEndCard(effectiveStatus) || dismissedKey === dismissKey) {
    return null;
  }
  if (isAtRisk && !showAtRiskCard) return null;

  const pending = restoreStreak.isPending;
  const fireColor = isAtRisk
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

  return (
    <View
      style={[
        styles.card,
        {
          borderColor: isAtRisk
            ? colors.isDark
              ? STREAK_COLORS.atRiskBorderDark
              : STREAK_COLORS.atRiskBorderLight
            : colors.border,
          backgroundColor: isAtRisk
            ? colors.isDark
              ? STREAK_COLORS.atRiskSoftDark
              : STREAK_COLORS.atRiskSoftLight
            : colors.surface,
        },
      ]}>
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          setDismissedKey(dismissKey);
        }}
        hitSlop={10}
        style={styles.closeBtn}
        accessibilityRole="button"
        accessibilityLabel="Dismiss">
        <Icon name="close" size={16} color={colors.textTertiary} />
      </Pressable>

      {isAtRisk ? (
        <View style={styles.atRiskBody}>
          <View style={[styles.riskBadge, { backgroundColor: STREAK_COLORS.atRisk }]}>
            <Icon name="warning" size={12} color={STREAK_COLORS.onAtRisk} filled />
            <Text style={styles.riskBadgeText}>At risk</Text>
          </View>
          <Text style={[styles.atRiskHint, { color: colors.text }]} numberOfLines={2}>
            {streakEndsInLabel(endsInMs)}
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.row}>
            <AnimatedStreakFire color={fireColor} size={FIRE_SIZE} animate={false} pulse={false} />
            <Text style={[styles.line, { color: colors.text }]}>
              {streakEndLine(effectiveStatus, variant)}
            </Text>
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
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
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
  atRiskBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 22,
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  riskBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    textTransform: 'uppercase',
  },
  atRiskHint: {
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
