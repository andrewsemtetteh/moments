import { StyleSheet, View } from 'react-native';

import { AnimatedStreakFire } from '@/components/home/AnimatedStreakFire';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { STREAK_COLORS } from '@/lib/streak-colors';
import type { StreakDayState, StreakDayTone } from '@/lib/streak-days';

export const STREAK_LOST_RED = '#9B2C3D';
export const STREAK_AT_RISK = STREAK_COLORS.atRisk;
export const STREAK_AT_RISK_DEEP = STREAK_COLORS.atRiskDeep;

type CircleSize = 'md' | 'sm';

const SIZES: Record<CircleSize, { outer: number; fire: number; icon: number; badge: number }> = {
  md: { outer: 38, fire: 24, icon: 14, badge: 13 },
  sm: { outer: 34, fire: 20, icon: 12, badge: 11 },
};

const STREAKED_PALETTE = {
  soft: STREAK_COLORS.successFill,
  main: STREAK_COLORS.success,
  border: STREAK_COLORS.successBright,
  glow: STREAK_COLORS.success,
  onMain: STREAK_COLORS.onSuccess,
} as const;

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
  isToday = false,
  size = 'md',
}: StreakDayCircleProps) {
  const { colors } = useTheme();
  const dim = SIZES[size];
  const radius = dim.outer / 2;

  if (isStreakActiveState(state)) {
    return (
      <View
        style={[
          styles.streakActiveCircle,
          {
            width: dim.outer,
            height: dim.outer,
            borderRadius: radius,
            backgroundColor: STREAKED_PALETTE.soft,
            borderColor: STREAKED_PALETTE.border,
          },
          isToday && [styles.todayGlow, { shadowColor: STREAKED_PALETTE.glow }],
        ]}>
        <AnimatedStreakFire
          color={STREAKED_PALETTE.main}
          size={dim.fire}
          animate={isToday}
          pulse={isToday}
        />
        <View
          style={[
            styles.checkBadge,
            {
              width: dim.badge,
              height: dim.badge,
              borderRadius: dim.badge / 2,
              backgroundColor: STREAKED_PALETTE.border,
              borderColor: colors.surface,
            },
          ]}>
          <Icon name="check" size={dim.badge - 4} color={STREAKED_PALETTE.onMain} filled />
        </View>
      </View>
    );
  }

  if (state === 'missed') {
    return (
      <View
        style={[
          styles.circle,
          {
            width: dim.outer,
            height: dim.outer,
            borderRadius: radius,
            backgroundColor: STREAK_LOST_RED,
          },
        ]}>
        <Icon name="close" size={dim.icon} color="#fff" />
      </View>
    );
  }

  if (state === 'today-at-risk') {
    return (
      <View
        style={[
          styles.circle,
          {
            width: dim.outer,
            height: dim.outer,
            borderRadius: radius,
            backgroundColor: STREAK_AT_RISK,
            borderColor: STREAK_AT_RISK_DEEP,
            borderWidth: 2.5,
          },
          isToday && [styles.dangerGlow, { shadowColor: STREAK_AT_RISK }],
        ]}>
        <AnimatedStreakFire color="#fff" size={dim.fire - 2} animate pulse />
        <View style={[styles.pendingBadge, { backgroundColor: STREAK_AT_RISK_DEEP }]}>
          <Icon name="warning" size={dim.badge - 2} color="#fff" filled />
        </View>
      </View>
    );
  }

  if (state === 'today-pending') {
    return (
      <View
        style={[
          styles.circle,
          styles.todayAwaiting,
          {
            width: dim.outer,
            height: dim.outer,
            borderRadius: radius,
            backgroundColor: STREAK_COLORS.pendingSoft,
            borderColor: STREAK_COLORS.pending,
          },
          isToday && [styles.todayGlow, { shadowColor: STREAK_COLORS.pending }],
        ]}>
        <AnimatedStreakFire
          color={STREAK_COLORS.pendingBright}
          size={dim.fire - 4}
          animate
          pulse
        />
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
          opacity: state === 'inactive' ? 0.3 : state === 'future' ? 0.5 : 1,
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
    borderWidth: 2,
    position: 'relative',
  },
  todayGlow: {
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  checkBadge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  todayAwaiting: {
    borderWidth: 2.5,
    borderStyle: 'dashed',
  },
  pendingBadge: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerGlow: {
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
