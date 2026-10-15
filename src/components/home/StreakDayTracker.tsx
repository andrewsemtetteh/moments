import { addMonths, format, isAfter, isBefore, isSameMonth, isSameYear, startOfMonth } from 'date-fns';
import * as Haptics from '@/lib/haptics';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { AnimatedStreakFire } from '@/components/home/AnimatedStreakFire';
import { StickerFlame } from '@/components/home/StickerFlame';
import { DashedRing } from '@/components/ui/DashedRing';
import { Icon } from '@/components/ui/Icon';
import { Radius } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { streakSubtitle } from '@/lib/streak';
import { STREAK_COLORS, streakToneFromStatus, streakWellColors } from '@/lib/streak-colors';
import {
  buildStreakMonth,
  buildStreakWeek,
  streakMonthNavBounds,
  type StreakDayCell,
  type StreakView,
} from '@/lib/streak-days';
import { isStreakVisuallyAtRisk } from '@/lib/streak-reminder-timing';
import { useRelationshipStore } from '@/stores';
import type { StreakStatus } from '@/types/database';

/** Monday first, the same as the week view. */
const WEEK_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

interface StreakDayTrackerProps {
  status: StreakStatus;
  joinedAt?: string | Date | null;
  /**
   * Streak page: just the Week / Month switch and calendar. The page already shows the
   * count, today's check-ins and best streak above it.
   */
  calendarOnly?: boolean;
}

export function StreakDayTracker({ status, joinedAt: joinedAtProp, calendarOnly = false }: StreakDayTrackerProps) {
  const { colors } = useTheme();
  // History starts at the earlier of joining and the first day you were both active,
  // so older streak days are reachable with the month arrows.
  const joinedAt = useMemo(() => {
    const first = [...(status.active_days ?? []), ...(status.activity_days ?? [])].sort()[0];
    const firstDay = first ? new Date(`${first}T00:00:00`) : null;
    const joined = joinedAtProp ? new Date(joinedAtProp) : null;
    if (!firstDay) return joinedAtProp;
    return !joined || firstDay < joined ? firstDay : joined;
  }, [joinedAtProp, status.active_days, status.activity_days]);
  const partner = useRelationshipStore((s) => s.partner);
  const partnerFirst = getFirstName(partner?.name) ?? 'Partner';
  const [view, setView] = useState<StreakView>('week');
  const bounds = useMemo(() => streakMonthNavBounds(joinedAt), [joinedAt]);
  const [month, setMonth] = useState(() => bounds.maxMonth);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const now = useMemo(() => new Date(nowTick), [nowTick]);

  useEffect(() => {
    if (!status.at_risk || status.current_streak <= 0) return;
    const id = setInterval(() => setNowTick(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [status.at_risk, status.current_streak]);

  const week = useMemo(() => buildStreakWeek(status, joinedAt, now), [status, joinedAt, now]);
  const monthGrid = useMemo(() => buildStreakMonth(status, month, joinedAt, now), [status, month, joinedAt, now]);

  const count = status.current_streak;
  const active = count > 0;
  const atRisk = isStreakVisuallyAtRisk(status, now);
  const tone = streakToneFromStatus(status, now);
  const well = streakWellColors(tone, colors);
  const statusLine = streakSubtitle(status, now);

  const setTab = (next: StreakView) => {
    if (next === view) return;
    void Haptics.selectionAsync();
    setView(next);
  };

  return (
    <View
      style={[
        styles.card,
        calendarOnly
          ? { backgroundColor: colors.surface, borderWidth: 0, borderRadius: 22 }
          : {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
            },
      ]}>
      <View style={styles.header}>
        {calendarOnly ? null : (
          <View style={styles.heroRow}>
            <AnimatedStreakFire color={well.fire} size={56} layered animate={false} pulse={false} />

            <View style={styles.heroCopy}>
              <View style={styles.countRow}>
                <Text style={[styles.count, { color: colors.text }]}>{count}</Text>
                <Text style={[styles.countUnit, { color: well.label }]}>day streak</Text>
              </View>
              <Text style={[styles.statusLine, { color: colors.textSecondary }]} numberOfLines={2}>
                {statusLine}
              </Text>
            </View>
          </View>
        )}

        <View style={[styles.segment, { backgroundColor: colors.surfaceElevated }]}>
          <SegmentTab
            label="Week"
            selected={view === 'week'}
            onPress={() => setTab('week')}
            selectedColor={colors.accent}
            textColor={colors.onAccent}
            mutedColor={colors.textSecondary}
          />
          <SegmentTab
            label="Month"
            selected={view === 'month'}
            onPress={() => setTab('month')}
            selectedColor={colors.accent}
            textColor={colors.onAccent}
            mutedColor={colors.textSecondary}
          />
        </View>
      </View>

      {calendarOnly ? null : (
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
              <Text style={[styles.bestValue, { color: colors.textSecondary }]}>{status.longest_streak}d</Text>
            </View>
          ) : null}
        </View>
      )}

      {view === 'week' ? (
        <WeekStreakRow days={week} />
      ) : (
        <StreakMonthCalendar
          month={month}
          onMonthChange={setMonth}
          days={monthGrid.days}
          // buildStreakMonth counts from Sunday; the grid starts on Monday.
          leadingBlanks={(monthGrid.leadingBlanks + 6) % 7}
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
      <Text style={[styles.segmentLabel, { color: selected ? textColor : mutedColor }]}>{label}</Text>
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
  const border = done ? STREAK_COLORS.active : atRisk ? STREAK_COLORS.atRisk : c.border;
  const dot = done ? STREAK_COLORS.active : atRisk ? STREAK_COLORS.atRisk : waiting ? STREAK_COLORS.pending : c.border;

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

const TODAY_AMBER_DARK = '#FFC23D';

const isActiveDay = (day: StreakDayCell | null | undefined) =>
  !!day && (day.state === 'completed' || day.state === 'today-done');

/** "5 active days" — orange when there's something to count. */
function ActiveCount({ n, of }: { n: number; of?: number }) {
  const { colors } = useTheme();
  return (
    <View style={calStyles.countRow}>
      <Icon name="fire" size={14} color={n > 0 ? STREAK_COLORS.active : colors.textTertiary} filled />
      <Text style={[calStyles.countText, { color: n > 0 ? STREAK_COLORS.active : colors.textTertiary }]}>
        {n}
        {of ? ` of ${of}` : ''} active day{n === 1 && !of ? '' : 's'}
      </Text>
    </View>
  );
}

/**
 * One day. Days you both showed up are solid orange; back-to-back ones merge
 * into one orange capsule so a run reads as one streak.
 */
function DayCell({
  day,
  prevActive,
  nextActive,
  size,
  flame = false,
}: {
  day: StreakDayCell;
  prevActive: boolean;
  nextActive: boolean;
  size: number;
  /** Week view: a flame in the circle instead of the date. */
  flame?: boolean;
}) {
  const { colors } = useTheme();
  const dark = colors.isDark;
  const active = isActiveDay(day);
  const iconSize = Math.round(size * 0.5);
  const number = String(day.dayOfMonth);

  let circle: ViewStyle = { backgroundColor: 'transparent' };
  let content: ReactNode = null;
  let ring: ReactNode = null;
  let badge: ReactNode = null;

  if (active) {
    // Lit, like the milestone celebration: yellow, bold ink outline, sticker flame.
    circle = { backgroundColor: '#FFE7A0', borderWidth: 2, borderColor: '#000000' };
    if (flame) {
      content = <StickerFlame size={Math.round(size * 0.46)} />;
    } else {
      // Month: the date, with a little sticker flame on the corner (like a missed day's ✕).
      content = <Text style={[calStyles.num, calStyles.numActive, { color: '#000000' }]}>{number}</Text>;
      badge = (
        <View style={[calStyles.cornerBadge, { backgroundColor: '#FFFFFF', borderColor: '#000000' }]}>
          <StickerFlame size={9} />
        </View>
      );
    }
  } else if (day.state === 'today-at-risk') {
    circle = {
      backgroundColor: dark ? STREAK_COLORS.atRiskSoftDark : STREAK_COLORS.atRiskSoftLight,
      borderWidth: 2,
      borderColor: STREAK_COLORS.atRisk,
    };
    content = flame ? (
      <Icon name="fire" size={iconSize} color={STREAK_COLORS.atRisk} filled />
    ) : (
      <Text style={[calStyles.num, calStyles.numActive, { color: STREAK_COLORS.atRisk }]}>{number}</Text>
    );
  } else if (day.state === 'today-pending') {
    // Brighter amber in dark mode, where the soft tint and thin dashes got lost.
    const amber = dark ? TODAY_AMBER_DARK : STREAK_COLORS.pending;
    circle = { backgroundColor: dark ? 'rgba(255, 194, 61, 0.26)' : STREAK_COLORS.pendingSoftLight };
    ring = <DashedRing size={size} width={dark ? 2.5 : 2} color={amber} />;
    content = flame ? (
      <Icon name="fire" size={iconSize} color={amber} />
    ) : (
      <Text style={[calStyles.num, calStyles.numActive, { color: dark ? amber : colors.text }]}>{number}</Text>
    );
  } else if (day.state === 'missed') {
    // The original missed look: soft red circle with a red rim, the date, and a small ✕ badge.
    circle = {
      backgroundColor: dark ? STREAK_COLORS.lostSoftDark : STREAK_COLORS.lostSoftLight,
      borderWidth: 1.5,
      borderColor: STREAK_COLORS.lost,
    };
    content = <Text style={[calStyles.num, calStyles.numActive, { color: STREAK_COLORS.lostDeep }]}>{number}</Text>;
    badge = (
      <View style={[calStyles.cornerBadge, { backgroundColor: STREAK_COLORS.lost, borderColor: colors.surface }]}>
        <Icon name="close" size={9} color={STREAK_COLORS.onLost} />
      </View>
    );
  } else if (day.state === 'future') {
    // Upcoming: a faint short-dash circle, as on Home's intro card.
    circle = { opacity: 0.45 };
    ring = <DashedRing size={size} color={colors.borderStrong} />;
    content = flame ? null : <Text style={[calStyles.num, { color: colors.textTertiary }]}>{number}</Text>;
  } else {
    const faded = day.state === 'inactive';
    if (flame) {
      // Week view: every day keeps a visible shape. Before you joined: faint dashes;
      // an ordinary day: an outlined circle.
      if (faded) {
        circle = { opacity: 0.45 };
        ring = <DashedRing size={size} color={colors.borderStrong} />;
      } else {
        circle = { backgroundColor: colors.surfaceElevated, borderWidth: 2, borderColor: colors.borderStrong };
      }
      content = null;
    } else {
      circle = { backgroundColor: 'transparent', opacity: faded ? 0.45 : 1 };
      content = (
        <Text style={[calStyles.num, { color: faded ? colors.textTertiary : colors.textSecondary }]}>{number}</Text>
      );
    }
  }

  return (
    <View style={calStyles.cell}>
      <View style={[calStyles.slot, { height: size }]}>
        {active && (prevActive || nextActive) ? (
          <View
            style={[
              calStyles.band,
              {
                backgroundColor: '#FFE7A0',
                left: prevActive ? 0 : '50%',
                right: nextActive ? 0 : '50%',
              },
            ]}
          />
        ) : null}
        <View style={[calStyles.circle, { width: size, height: size, borderRadius: size / 2 }, circle]}>
          {ring}
          {content}
          {badge}
        </View>
      </View>
    </View>
  );
}

/** A row of seven slots (null = blank) with runs joined inside the row. */
function DayRow({ cells, size, flame }: { cells: (StreakDayCell | null)[]; size: number; flame?: boolean }) {
  return (
    <View style={calStyles.row}>
      {cells.map((day, i) =>
        day ? (
          <DayCell
            key={day.date.toISOString()}
            day={day}
            prevActive={isActiveDay(cells[i - 1])}
            nextActive={isActiveDay(cells[i + 1])}
            size={size}
            flame={flame}
          />
        ) : (
          <View key={`blank-${i}`} style={calStyles.cell} />
        ),
      )}
    </View>
  );
}

function WeekdayLabels({ labels, todayIndex }: { labels: readonly string[]; todayIndex?: number }) {
  const { colors } = useTheme();
  return (
    <View style={calStyles.row}>
      {labels.map((label, i) => (
        <Text
          key={`${label}-${i}`}
          style={[
            calStyles.weekday,
            { color: i === todayIndex ? colors.text : colors.textTertiary },
            i === todayIndex && calStyles.weekdayToday,
          ]}>
          {label}
        </Text>
      ))}
    </View>
  );
}

function WeekStreakRow({ days }: { days: StreakDayCell[] }) {
  const { colors } = useTheme();
  const active = days.filter(isActiveDay).length;
  return (
    <View style={calStyles.block}>
      <View style={calStyles.head}>
        <Text style={[calStyles.title, { color: colors.text }]}>This week</Text>
        <ActiveCount n={active} of={days.length} />
      </View>
      <WeekdayLabels labels={WEEK_DAYS} todayIndex={days.findIndex((d) => d.isToday)} />
      <DayRow cells={days} size={42} flame />
      <View style={calStyles.row}>
        {days.map((day) => (
          <Text
            key={`date-${day.date.toISOString()}`}
            style={[
              calStyles.weekDate,
              { color: day.isToday ? colors.text : colors.textTertiary },
              day.isToday && calStyles.weekdayToday,
            ]}>
            {day.dayOfMonth}
          </Text>
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
  /** Blank slots before day 1, Monday first. */
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

  const rows = useMemo(() => {
    const slots: (StreakDayCell | null)[] = [...Array.from({ length: leadingBlanks }, () => null), ...days];
    while (slots.length % 7) slots.push(null);
    const out: (StreakDayCell | null)[][] = [];
    for (let i = 0; i < slots.length; i += 7) out.push(slots.slice(i, i + 7));
    return out;
  }, [days, leadingBlanks]);

  const isThisMonth = isSameMonth(month, new Date());
  const todayIndex = isThisMonth ? (new Date().getDay() + 6) % 7 : undefined;

  return (
    <View style={calStyles.block}>
      <View style={calStyles.monthHeader}>
        <Pressable
          onPress={() => shiftMonth(-1)}
          disabled={!canGoPrev}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          style={[calStyles.navBtn, { backgroundColor: colors.surfaceElevated, opacity: canGoPrev ? 1 : 0.3 }]}>
          <Icon name="chevronLeft" size={18} color={colors.text} />
        </Pressable>
        <View style={calStyles.monthTitleWrap}>
          <Text style={[calStyles.title, { color: colors.text }]}>
            {format(month, isSameYear(month, new Date()) ? 'MMMM' : 'MMMM yyyy')}
          </Text>
        </View>
        <Pressable
          onPress={() => shiftMonth(1)}
          disabled={!canGoNext}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Next month"
          style={[calStyles.navBtn, { backgroundColor: colors.surfaceElevated, opacity: canGoNext ? 1 : 0.3 }]}>
          <Icon name="chevronRight" size={18} color={colors.text} />
        </Pressable>
      </View>

      <WeekdayLabels labels={WEEK_DAYS} todayIndex={todayIndex} />
      <View style={calStyles.rows}>
        {rows.map((cells, i) => (
          <DayRow key={i} cells={cells} size={38} />
        ))}
      </View>
    </View>
  );
}

const calStyles = StyleSheet.create({
  block: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  countText: { fontSize: 13, fontWeight: '800' },

  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  monthTitleWrap: { alignItems: 'center', gap: 2 },
  navBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  // Seven equal columns, shared by labels, days and dates, so everything lines up.
  row: { flexDirection: 'row' },
  rows: { gap: 8 },
  cell: { flex: 1, alignItems: 'center', minWidth: 0 },
  slot: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  band: { position: 'absolute', top: 0, bottom: 0 },
  circle: { alignItems: 'center', justifyContent: 'center' },
  num: { fontSize: 14, fontWeight: '600', letterSpacing: -0.2 },
  numActive: { fontWeight: '900' },
  // Small corner badge: ✕ on a missed day, flame on a streak day (month).
  cornerBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },

  weekday: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  weekdayToday: { fontWeight: '900' },
  weekDate: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700' },
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
    borderRadius: 999,
    padding: 4,
    gap: 4,
  },
  segmentTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 999,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '800',
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
  },
  bestValue: {
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
});
