import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withSpring,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SparkStreakFlame } from '@/components/home/SparkStreakFlame';
import { Icon } from '@/components/ui/Icon';
import { useStreak } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { buildMilestoneWeek, type StreakDayCell } from '@/lib/streak-days';
import { useRelationshipStore, useUIStore } from '@/stores';

const FLAME_ORANGE = '#FF8A00';
const DAY_SIZE = 40;

function sparkStatusCopy(count: number, partnerName?: string | null): { lead: string; sub: string } {
  const partner = getFirstName(partnerName) ?? 'your partner';
  if (count <= 1) {
    return {
      lead: 'A new streak begins!',
      sub: `Show up with ${partner} each day to keep it going.`,
    };
  }
  return {
    lead: `${count} day streak`,
    sub: `You and ${partner} kept the flame alive. See you tomorrow.`,
  };
}

export function StreakSparkModal() {
  const { colors } = useTheme();
  const spark = useUIStore((s) => s.streakSpark);
  const closeStreakSpark = useUIStore((s) => s.closeStreakSpark);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const { data: streak } = useStreak();
  const [todayLit, setTodayLit] = useState(false);

  const visible = spark != null && spark.count > 0;
  const count = spark?.count ?? 0;
  const fromCount = spark?.fromCount ?? 0;

  const week = useMemo(
    () =>
      count > 0
        ? buildMilestoneWeek(count, relationship?.created_at, streak ?? null)
        : [],
    [count, relationship?.created_at, streak],
  );

  const copy = useMemo(
    () => sparkStatusCopy(count, partner?.name),
    [count, partner?.name],
  );

  useEffect(() => {
    if (!visible) {
      setTodayLit(false);
      return;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setTodayLit(false);
  }, [visible, count]);

  if (!visible || !spark) return null;

  const handleClose = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    closeStreakSpark();
  };

  return (
    <Modal
      visible
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
      presentationStyle="fullScreen">
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.content} edges={['top', 'bottom']}>
          <View style={styles.main}>
            <SparkStreakFlame
              count={count}
              fromCount={fromCount}
              onSettled={() => setTodayLit(true)}
            />
            <Text style={[styles.title, { color: colors.text }]}>Day Streak</Text>
          </View>

          <View style={styles.bottom}>
            <SparkWeekTracker
              days={week}
              lightToday={todayLit}
              textColor={colors.text}
              mutedColor={colors.textSecondary}
              borderColor={colors.border}
              surfaceColor={colors.surfaceElevated}
            />
            <Text style={styles.status}>
              <Text style={[styles.statusLead, { color: colors.text }]}>{copy.lead}</Text>
              {'\n'}
              <Text style={[styles.statusSub, { color: colors.textSecondary }]}>{copy.sub}</Text>
            </Text>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.cta,
                { backgroundColor: colors.accent },
                pressed && styles.ctaPressed,
              ]}>
              <Text style={[styles.ctaText, { color: colors.onAccent }]}>Continue</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function SparkWeekTracker({
  days,
  lightToday,
  textColor,
  mutedColor,
  borderColor,
  surfaceColor,
}: {
  days: StreakDayCell[];
  lightToday: boolean;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  surfaceColor: string;
}) {
  return (
    <View style={styles.tracker}>
      <View style={styles.weekdayRow}>
        {days.map((day) => (
          <Text
            key={`label-${day.date.toISOString()}`}
            style={[
              styles.weekday,
              { color: day.isToday ? textColor : mutedColor },
              day.isToday && styles.weekdayToday,
            ]}>
            {format(day.date, 'EEEEE')}
          </Text>
        ))}
      </View>
      <View style={styles.trackRow}>
        {days.map((day) => (
          <View key={day.date.toISOString()} style={styles.trackCell}>
            <SparkDayDot
              day={day}
              lightToday={lightToday}
              borderColor={borderColor}
              surfaceColor={surfaceColor}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function SparkDayDot({
  day,
  lightToday,
  borderColor,
  surfaceColor,
}: {
  day: StreakDayCell;
  lightToday: boolean;
  borderColor: string;
  surfaceColor: string;
}) {
  const filled = day.isToday
    ? lightToday
    : day.state === 'completed' || day.state === 'today-done';
  const showTodayPending = day.isToday && !lightToday;

  const scale = useSharedValue(1);

  useEffect(() => {
    if (day.isToday && lightToday) {
      scale.value = 0.72;
      scale.value = withDelay(40, withSpring(1, { damping: 10, stiffness: 200 }));
    }
  }, [day.isToday, lightToday, scale]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (filled) {
    return (
      <Animated.View style={[styles.dayCircle, styles.dayCircleActive, anim]}>
        <Icon name="fire" size={18} color="#FFFFFF" filled />
        {day.isToday ? (
          <View style={[styles.checkBadge, { backgroundColor: surfaceColor, borderColor: FLAME_ORANGE }]}>
            <Icon name="check" size={10} color={FLAME_ORANGE} />
          </View>
        ) : null}
      </Animated.View>
    );
  }

  if (showTodayPending) {
    return (
      <View style={[styles.dayCircle, styles.dayCircleOutline, { borderColor }]} />
    );
  }

  return <View style={[styles.dayCircle, styles.dayCircleEmpty, { borderColor }]} />;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 28,
    justifyContent: 'space-between',
  },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 52,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  bottom: {
    gap: 24,
    paddingBottom: 8,
  },
  tracker: {
    gap: 12,
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
  },
  weekdayToday: {
    fontWeight: '800',
  },
  trackRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trackCell: {
    flex: 1,
    alignItems: 'center',
  },
  dayCircle: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleActive: {
    backgroundColor: FLAME_ORANGE,
  },
  dayCircleOutline: {
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  dayCircleEmpty: {
    borderWidth: 2,
    backgroundColor: 'transparent',
  },
  checkBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  status: {
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  statusLead: {
    fontSize: 16,
    fontWeight: '700',
  },
  statusSub: {
    fontSize: 15,
    fontWeight: '400',
  },
  cta: {
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
