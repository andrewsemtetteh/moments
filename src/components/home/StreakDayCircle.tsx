import { StyleSheet, View } from 'react-native';

import { AnimatedStreakFire } from '@/components/home/AnimatedStreakFire';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { STREAK_COLORS } from '@/lib/streak-colors';
import type { StreakDayState, StreakDayTone } from '@/lib/streak-days';

export const STREAK_LOST_RED = STREAK_COLORS.lost;
export const STREAK_AT_RISK = STREAK_COLORS.atRisk;
export const STREAK_AT_RISK_DEEP = STREAK_COLORS.atRiskDeep;

type CircleSize = 'md' | 'sm';

const SIZES: Record<CircleSize, { outer: number; fire: number; icon: number; badge: number }> = {
  md: { outer: 38, fire: 22, icon: 14, badge: 13 },
  sm: { outer: 34, fire: 18, icon: 12, badge: 11 },
};

export function isStreakActiveState(state: StreakDayState): boolean {
  return state === 'completed' || state === 'today-done';
}

export function isStreakDangerState(state: StreakDayState): boolean {
  return state === 'today-at-risk';
}

interface StreakDayCircleProps {
  state: StreakDayState;
  tone?: StreakDayTone;
  isToday?: boolean;
  size?: CircleSize;
}

export function StreakDayCircle({
  state,
  tone: _tone = 'success',
  isToday: _isToday = false,
  size = 'md',
}: StreakDayCircleProps) {
  const { colors } = useTheme();
  const dark = colors.isDark;
  const dim = SIZES[size];
  const radius = dim.outer / 2;

  if (isStreakActiveState(state)) {
    const fill = dark ? STREAK_COLORS.activeFillDark : STREAK_COLORS.activeFillLight;
    return (
      <View
        style={[
          styles.streakActiveCircle,
          {
            width: dim.outer,
            height: dim.outer,
            borderRadius: radius,
            backgroundColor: fill,
            borderColor: STREAK_COLORS.active,
          },
        ]}>
        <AnimatedStreakFire color={STREAK_COLORS.active} size={dim.fire} animate={false} />
        <View
          style={[
            styles.checkBadge,
            {
              width: dim.badge,
              height: dim.badge,
              borderRadius: dim.badge / 2,
              backgroundColor: STREAK_COLORS.active,
              borderColor: colors.surface,
            },
          ]}>
          <Icon name="check" size={dim.badge - 4} color={STREAK_COLORS.onActive} filled />
        </View>
      </View>
    );
  }

  if (state === 'missed') {
    const fill = dark ? STREAK_COLORS.lostSoftDark : STREAK_COLORS.lostSoftLight;
    return (
      <View
        style={[
          styles.circle,
          {
            width: dim.outer,
            height: dim.outer,
            borderRadius: radius,
            backgroundColor: fill,
            borderColor: STREAK_COLORS.lost,
            borderWidth: 1.5,
          },
        ]}>
        <Icon name="close" size={dim.icon} color={STREAK_COLORS.lostDeep} />
      </View>
    );
  }

  if (state === 'today-at-risk') {
    const fill = dark ? STREAK_COLORS.atRiskSoftDark : STREAK_COLORS.atRiskSoftLight;
    return (
      <View
        style={[
          styles.circle,
          {
            width: dim.outer,
            height: dim.outer,
            borderRadius: radius,
            backgroundColor: fill,
            borderColor: STREAK_COLORS.atRisk,
            borderWidth: 2,
          },
        ]}>
        <AnimatedStreakFire color={STREAK_COLORS.atRisk} size={dim.fire - 2} animate={false} />
      </View>
    );
  }

  if (state === 'today-pending') {
    const fill = dark ? STREAK_COLORS.pendingSoftDark : STREAK_COLORS.pendingSoftLight;
    return (
      <View
        style={[
          styles.circle,
          {
            width: dim.outer,
            height: dim.outer,
            borderRadius: radius,
            backgroundColor: fill,
            borderColor: STREAK_COLORS.pending,
            borderWidth: 2,
            borderStyle: 'dashed',
          },
        ]}>
        <AnimatedStreakFire color={STREAK_COLORS.pendingBright} size={dim.fire - 4} animate={false} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.circle,
        {
          width: dim.outer,
          height: dim.outer,
          borderRadius: radius,
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          opacity: state === 'inactive' ? 0.35 : state === 'future' ? 0.55 : 1,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  streakActiveCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    position: 'relative',
  },
  checkBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
});
