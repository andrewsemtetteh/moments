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
import { getFirstName } from '@/lib/avatar-initial';
import { streakSubtitle } from '@/lib/streak';
import {
  STREAK_COLORS,
  streakToneFromStatus,
  streakWellColors,
} from '@/lib/streak-colors';
import {
  buildStreakMonth,
  buildStreakWeek,
  streakMonthNavBounds,
  streakWeekLineSpan,
  type StreakDayCell,
  type StreakView,
} from '@/lib/streak-days';
import { useRelationshipStore } from '@/stores';
import type { StreakStatus } from '@/types/database';

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

interface StreakDayTrackerProps {
  status: StreakStatus;
  joinedAt?: string | Date | null;
}

export function StreakDayTracker({ status, joinedAt }: StreakDayTrackerProps) {
  const { colors } = useTheme();
  const partner = useRelationshipStore((s) => s.partner);
  const partnerFirst = getFirstName(partner?.name) ?? 'Partner';
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
  const atRisk = status.at_risk && active;
  const tone = streakToneFromStatus(status);
  const well = streakWellColors(tone, colors);
  const statusLine = streakSubtitle(status);

  const setTab = (next: StreakView) => {
    if (next === view) return;
    void Haptics.selectionAsync();
    setView(next);
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: atRisk ? well.cardBg : colors.surface,
          borderColor: well.cardBorder,
          borderWidth: atRisk ? 1.5 : StyleSheet.hairlineWidth,
        },
      ]}>
      <View style={styles.header}>
        <View style={styles.heroRow}>
          <AnimatedStreakFire
            color={well.fire}
            size={56}
            layered
            animate={atRisk || active}
            pulse={atRisk}
          />

          <View style={styles.heroCopy}>
            <View style={styles.countRow}>
              <Text style={[styles.count, { color: colors.text }]}>{count}</Text>
              <Text style={[styles.countUnit, { color: well.label }]}>day streak</Text>
            </View>
            <Text
              style={[
                styles.statusLine,
                { color: atRisk ? well.bannerText : colors.textSecondary },
              ]}
              numberOfLines={2}>
              {statusLine}
            </Text>
          </View>
        </View>

        <View style={[styles.segment, { backgroundColor: colors.surfaceElevated }]}>
          <SegmentTab
            label="Week"
            selected={view === 'week'}
            onPress={() => setTab('week')}
            selectedColor={colors.surface}
            textColor={colors.text}
            mutedColor={colors.textTertiary}
          />
          <SegmentTab
            label="Month"
            selected={view === 'month'}
            onPress={() => setTab('month')}
            selectedColor={colors.surface}
            textColor={colors.text}
            mutedColor={colors.textTertiary}
          />
        </View>
      </View>

      <View style={styles.checkRow}>
        <CheckInChip
          label="You"
          done={status.user_active_today}
          waiting={active && !status.user_active_today}
          atRisk={atRisk && !status.user_active_today}
          isDark={colors.isDark}
          colors={{
            text: colors.text,
            muted: colors.textTertiary,
            surface: colors.surfaceElevated,
            border: colors.border,
          }}
        />
        <CheckInChip
          label={partnerFirst}
          done={status.partner_active_today}
          waiting={active && !status.partner_active_today}
          atRisk={atRisk && !status.partner_active_today}
          isDark={colors.isDark}
          colors={{
            text: colors.text,
            muted: colors.textTertiary,
            surface: colors.surfaceElevated,
            border: colors.border,
          }}
        />
        {status.longest_streak > 0 ? (
          <View style={styles.bestWrap}>
            <Text style={[styles.bestLabel, { color: colors.textTertiary }]}>Best</Text>
            <Text style={[styles.bestValue, { color: colors.textSecondary }]}>
              {status.longest_streak}d
            </Text>
          </View>
        ) : null}
      </View>

      {atRisk ? (
        <View
          style={[
            styles.riskBanner,
            {
              backgroundColor: well.bannerBg,
              borderColor: well.cardBorder,
            },
          ]}>
          <View style={[styles.riskBadge, { backgroundColor: STREAK_COLORS.atRisk }]}>
            <Icon name="warning" size={12} color={STREAK_COLORS.onAtRisk} filled />
            <Text style={styles.riskBadgeText}>At risk</Text>
          </View>
          <Text style={[styles.riskText, { color: well.bannerText }]}>
            {status.user_active_today
              ? `${partnerFirst} still needs to check in before midnight`
              : 'Check in today or this streak ends at midnight'}
          </Text>
        </View>
      ) : null}

      {view === 'week' ? (
        <WeekStreakRow days={week} labelColor={colors.textTertiary} todayColor={colors.text} />
      ) : (
        <StreakMonthCalendar
          month={month}
          onMonthChange={setMonth}
          days={monthGrid.days}
          leadingBlanks={monthGrid.leadingBlanks}
          joinedAt={joinedAt}
        />
      )}
    </View>
  );
}

function SegmentTab({
  label,
  selected,
  onPress,
  selectedColor,
  textColor,
  mutedColor,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  selectedColor: string;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.segmentTab, selected && { backgroundColor: selectedColor }]}
      accessibilityRole="tab"
      accessibilityState={{ selected }}>
      <Text style={[styles.segmentLabel, { color: selected ? textColor : mutedColor }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function CheckInChip({
  label,
  done,
  waiting,
  atRisk = false,
  isDark = false,
  colors: c,
}: {
  label: string;
  done: boolean;
  waiting: boolean;
  atRisk?: boolean;
  isDark?: boolean;
  colors: { text: string; muted: string; surface: string; border: string };
}) {
  const fill = done
    ? isDark
      ? STREAK_COLORS.activeSoftDark
      : STREAK_COLORS.activeSoftLight
    : atRisk
      ? isDark
        ? STREAK_COLORS.atRiskSoftDark
        : STREAK_COLORS.atRiskSoftLight
      : c.surface;
  const border = done
    ? STREAK_COLORS.active
    : atRisk
      ? STREAK_COLORS.atRisk
      : c.border;
  const dot = done
    ? STREAK_COLORS.active
    : atRisk
      ? STREAK_COLORS.atRisk
      : waiting
        ? STREAK_COLORS.pending
        : c.border;

  return (
    <View style={[styles.chip, { backgroundColor: fill, borderColor: border }]}>
      <View style={[styles.chipDot, { backgroundColor: dot }]} />
      <Text style={[styles.chipLabel, { color: done || atRisk ? c.text : c.muted }]} numberOfLines={1}>
        {label}
      </Text>
      {done ? <Icon name="check" size={12} color={STREAK_COLORS.active} filled /> : null}
    </View>
  );
}

function WeekStreakRow({
  days,
  labelColor,
  todayColor,
}: {
  days: StreakDayCell[];
  labelColor: string;
  todayColor: string;
}) {
  const lineSpan = streakWeekLineSpan(days);

  return (
    <View style={styles.weekWrap}>
      <View style={styles.weekLabels}>
        {days.map((day) => (
          <Text
            key={`label-${day.date.toISOString()}`}
            style={[
              styles.weekLabel,
              { color: day.isToday ? todayColor : labelColor },
              day.isToday && styles.weekLabelToday,
            ]}>
            {format(day.date, 'EEEEE')}
          </Text>
        ))}
      </View>
      <View style={styles.weekTrack}>
        {lineSpan ? (
          <View
            style={[
              styles.streakLine,
              {
                backgroundColor: STREAK_COLORS.active,
                left: `${((lineSpan.start + 0.5) / days.length) * 100}%`,
                width: `${((lineSpan.end - lineSpan.start) / days.length) * 100}%`,
              },
            ]}
          />
        ) : null}
        <View style={styles.weekRow}>
          {days.map((day) => (
            <View key={day.date.toISOString()} style={styles.weekDay}>
              <StreakDayCircle
                state={day.state}
                tone={day.tone}
                isToday={day.isToday}
                dayOfMonth={day.dayOfMonth}
                size="md"
              />
            </View>
          ))}
        </View>
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
            <StreakDayCircle
              state={day.state}
              tone={day.tone}
              isToday={day.isToday}
              dayOfMonth={day.dayOfMonth}
              size="sm"
            />
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
    width: `${100 / 7}%` as `${number}%`,
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
    paddingTop: 16,
    paddingBottom: 16,
    gap: 14,
  },
  header: {
    gap: 14,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  count: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: -1.5,
    lineHeight: 40,
  },
  countUnit: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  statusLine: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 19,
  },
  segment: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    borderRadius: 12,
    padding: 3,
    gap: 2,
  },
  segmentTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '42%',
  },
  chipDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '700',
    flexShrink: 1,
  },
  bestWrap: {
    marginLeft: 'auto',
    alignItems: 'flex-end',
    paddingLeft: 4,
  },
  bestLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  bestValue: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  riskBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
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
  riskText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  weekWrap: {
    gap: 10,
    paddingTop: 2,
  },
  weekLabels: {
    flexDirection: 'row',
  },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
  weekLabelToday: {
    fontWeight: '800',
  },
  weekTrack: {
    position: 'relative',
    paddingBottom: 2,
  },
  streakLine: {
    position: 'absolute',
    top: 18,
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
});
