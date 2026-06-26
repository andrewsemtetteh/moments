import {
    addMonths,
    format,
    isAfter,
    isBefore,
    startOfMonth,
} from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AnimatedStreakFire } from '@/components/home/AnimatedStreakFire';
import { StreakDayCircle } from '@/components/home/StreakDayCircle';
import { Icon } from '@/components/ui/Icon';
import { Radius } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { streakMotivationHeadline } from '@/lib/streak';
import { STREAK_COLORS, streakFireColor } from '@/lib/streak-colors';
import {
    buildStreakMonth,
    buildStreakWeek,
    streakMonthNavBounds,
    streakWeekLineSpan,
    type StreakDayCell,
    type StreakView,
} from '@/lib/streak-days';
import type { StreakStatus } from '@/types/database';

const TABS: { id: StreakView; label: string }[] = [
  { id: 'week', label: '7 Day' },
  { id: 'month', label: 'Month' },
];
const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

interface StreakDayTrackerProps {
  status: StreakStatus;
  joinedAt?: string | Date | null;
}

export function StreakDayTracker({ status, joinedAt }: StreakDayTrackerProps) {
  const { colors } = useTheme();
  const [view, setView] = useState<StreakView>('week');
  const bounds = useMemo(() => streakMonthNavBounds(joinedAt), [joinedAt]);
  const [month, setMonth] = useState(() => bounds.maxMonth);
  const week = useMemo(() => buildStreakWeek(status, joinedAt), [status, joinedAt]);
  const monthGrid = useMemo(
    () => buildStreakMonth(status, month, joinedAt),
    [status, month, joinedAt],
  );

  const count = status.current_streak;
  const active = count > 0;
  const atRisk = status.at_risk;
  const fireColor = streakFireColor(
    active || atRisk,
    atRisk && !status.both_active_today,
    colors.textTertiary,
    status.both_active_today,
  );

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}>
      <View style={styles.hero}>
        <AnimatedStreakFire
          color={fireColor}
          size={36}
          animate={active || atRisk}
          pulse={atRisk}
        />
        <Text style={[styles.count, { color: colors.text }]}>{count}</Text>
        <Text style={[styles.countUnit, { color: atRisk ? colors.warning : colors.accent }]}>
          day streak
        </Text>
        <Text style={[styles.headline, { color: colors.textSecondary }]}>
          {streakMotivationHeadline(count)}
        </Text>
      </View>

      {view === 'week' ? (
        <WeekStreakRow days={week} />
      ) : (
        <StreakMonthCalendar
          month={month}
          onMonthChange={setMonth}
          days={monthGrid.days}
          leadingBlanks={monthGrid.leadingBlanks}
          joinedAt={joinedAt}
        />
      )}

      <View style={[styles.tabs, { borderTopColor: colors.border }]}>
        {TABS.map((tab) => {
          const selected = view === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setView(tab.id)}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected }}>
              <Text
                style={[
                  styles.tabLabel,
                  { color: selected ? colors.text : colors.textTertiary },
                ]}>
                {tab.label}
              </Text>
              {selected ? (
                <View style={[styles.tabIndicator, { backgroundColor: colors.accent }]} />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function WeekStreakRow({ days }: { days: StreakDayCell[] }) {
  const lineSpan = streakWeekLineSpan(days);

  return (
    <View style={styles.weekWrap}>
      {lineSpan ? (
        <View
          style={[
            styles.streakLine,
            {
              backgroundColor: STREAK_COLORS.success,
              left: `${((lineSpan.start + 0.5) / days.length) * 100}%`,
              width: `${((lineSpan.end - lineSpan.start) / days.length) * 100}%`,
            },
          ]}
        />
      ) : null}
      <View style={styles.weekRow}>
        {days.map((day) => (
          <View key={day.date.toISOString()} style={styles.weekDay}>
            <StreakDayCircle state={day.state} tone={day.tone} isToday={day.isToday} size="md" />
          </View>
        ))}
      </View>
    </View>
  );
}

function StreakMonthCalendar({
  month,
  onMonthChange,
  days,
  leadingBlanks,
  joinedAt,
}: {
  month: Date;
  onMonthChange: (month: Date) => void;
  days: StreakDayCell[];
  leadingBlanks: number;
  joinedAt?: string | Date | null;
}) {
  const { colors } = useTheme();
  const bounds = useMemo(() => streakMonthNavBounds(joinedAt), [joinedAt]);

  const canGoPrev = !isBefore(startOfMonth(addMonths(month, -1)), bounds.minMonth);
  const canGoNext = !isAfter(startOfMonth(addMonths(month, 1)), bounds.maxMonth);

  const shiftMonth = (delta: number) => {
    if (delta < 0 && !canGoPrev) return;
    if (delta > 0 && !canGoNext) return;
    void Haptics.selectionAsync();
    onMonthChange(addMonths(month, delta));
  };

  return (
    <View>
      <View style={monthStyles.monthHeader}>
        <Pressable
          onPress={() => shiftMonth(-1)}
          disabled={!canGoPrev}
          style={[
            monthStyles.navBtn,
            { backgroundColor: colors.surfaceElevated, opacity: canGoPrev ? 1 : 0.3 },
          ]}>
          <Icon name="chevronLeft" size={18} color={colors.text} />
        </Pressable>
        <Text style={[monthStyles.monthTitle, { color: colors.text }]}>
          {format(month, 'MMMM yyyy')}
        </Text>
        <Pressable
          onPress={() => shiftMonth(1)}
          disabled={!canGoNext}
          style={[
            monthStyles.navBtn,
            { backgroundColor: colors.surfaceElevated, opacity: canGoNext ? 1 : 0.3 },
          ]}>
          <Icon name="chevronRight" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={monthStyles.weekDays}>
        {WEEK_DAYS.map((label, index) => (
          <Text key={`${label}-${index}`} style={[monthStyles.weekDay, { color: colors.textTertiary }]}>
            {label}
          </Text>
        ))}
      </View>

      <View style={monthStyles.grid}>
        {Array.from({ length: leadingBlanks }).map((_, index) => (
          <View key={`blank-${index}`} style={monthStyles.dayCell} />
        ))}
        {days.map((day) => (
          <View key={day.date.toISOString()} style={monthStyles.dayCell}>
            <StreakDayCircle state={day.state} tone={day.tone} isToday={day.isToday} size="sm" />
          </View>
        ))}
      </View>
    </View>
  );
}

const monthStyles = StyleSheet.create({
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  navBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: { fontSize: 16, fontWeight: '800' },
  weekDays: { flexDirection: 'row', marginBottom: 4 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 44,
    alignItems: 'center',
    paddingTop: 2,
  },
});

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 14,
    gap: 16,
  },
  hero: {
    alignItems: 'center',
    gap: 2,
  },
  count: {
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -2,
    lineHeight: 48,
    marginTop: 4,
  },
  countUnit: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  headline: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  weekWrap: {
    position: 'relative',
    paddingTop: 4,
    paddingBottom: 2,
  },
  streakLine: {
    position: 'absolute',
    top: 22,
    height: 3,
    borderRadius: 2,
    opacity: 0.35,
    zIndex: 0,
  },
  weekRow: {
    flexDirection: 'row',
    zIndex: 1,
  },
  weekDay: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  tabs: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: -4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  tabIndicator: {
    height: 2,
    width: 28,
    borderRadius: 1,
  },
});
