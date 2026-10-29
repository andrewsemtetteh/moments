import {
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subWeeks,
} from 'date-fns';
import * as Haptics from '@/lib/haptics';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';

import type { ThemeColors } from '@/constants/design-system';
import { getEventTypeColors } from '@/constants/calendar-events';
import { colorWithAlpha } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import type { CalendarEvent } from '@/types/database';

const WEEK_STARTS_ON = 0 as const;
/** Shared day-circle size for week + month, so toggling doesn't shift the selection. */
const DAY_SIZE = 38;
const MAX_DOTS = 3;

function dayKey(day: Date) {
  return format(day, 'yyyy-MM-dd');
}

/**
 * One dot per distinct plan *type* on a day (date, anniversary, trip…), in
 * that type's color, capped at three — so a glance at the week shows what
 * kind of plans are coming, not just that something exists.
 */
function useEventDots(events: CalendarEvent[], colors: ThemeColors) {
  return useMemo(() => {
    const map = new Map<string, string[]>();
    const sorted = [...events].sort(
      (a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime(),
    );
    for (const e of sorted) {
      const key = dayKey(new Date(e.date_time));
      const color = getEventTypeColors(e.type, colors).main;
      const list = map.get(key) ?? [];
      if (!list.includes(color) && list.length < MAX_DOTS) list.push(color);
      map.set(key, list);
    }
    return map;
  }, [events, colors]);
}

function DayCell({
  day,
  selected,
  muted,
  dots,
  onPress,
}: {
  day: Date;
  selected: boolean;
  muted?: boolean;
  dots: string[];
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const today = isToday(day);
  // A day with plans gets a ringed circle instead of dots: soft green once it's gone by
  // ("done"), the theme colour for today and the days ahead.
  const hasPlans = dots.length > 0;
  const pastPlans = hasPlans && !today && day < startOfDay(new Date());
  const pastTint = pastPlans ? colors.success : null;
  const planTint = hasPlans && !pastPlans ? colors.accent : null;

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      hitSlop={4}
      style={styles.dayInner}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${format(day, 'EEEE, MMMM d')}${dots.length ? (pastPlans ? ', had plans' : ', has plans') : ''}`}>
      <View
        style={[
          styles.circle,
          selected
            ? { backgroundColor: colors.accent }
            : today
              ? {
                  backgroundColor: colors.accentSoft,
                  ...(planTint ? { borderWidth: 1.5, borderColor: colorWithAlpha(planTint, 0.6) } : null),
                }
              : pastTint || planTint
                ? {
                    backgroundColor: colorWithAlpha((pastTint ?? planTint)!, pastTint ? 0.16 : 0.12),
                    borderWidth: 1.5,
                    borderColor: colorWithAlpha((pastTint ?? planTint)!, 0.55),
                  }
                : null,
          muted && (pastTint || planTint) ? { opacity: 0.5 } : null,
        ]}>
        <Text
          style={[
            styles.num,
            {
              color: selected
                ? colors.onAccent
                : today
                  ? colors.accent
                  : muted
                    ? colors.textTertiary
                    : colors.text,
              fontWeight: selected || today ? '800' : hasPlans ? '700' : '500',
            },
          ]}>
          {format(day, 'd')}
        </Text>
      </View>
      <View style={styles.dots}>
        {/* The ring says it all now: no dots under the day. */}
      </View>
    </Pressable>
  );
}

export function PlanWeekStrip({
  selectedDate,
  events = [],
  onSelectDate,
}: {
  selectedDate: Date;
  events?: CalendarEvent[];
  onSelectDate: (day: Date) => void;
}) {
  const { colors } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const [pageW, setPageW] = useState(0);
  const [weekAnchor, setWeekAnchor] = useState(() =>
    startOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON }),
  );
  const dots = useEventDots(events, colors);

  // Keep the strip on the week that contains the selected day (Today pill, create, month
  // jumps): the anchor follows while rendering; the effect only re-centres the scroll.
  const selectedWeek = startOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON });
  const [anchoredTo, setAnchoredTo] = useState(selectedWeek.getTime());
  if (anchoredTo !== selectedWeek.getTime()) {
    setAnchoredTo(selectedWeek.getTime());
    setWeekAnchor((prev) => (isSameDay(prev, selectedWeek) ? prev : selectedWeek));
  }
  useEffect(() => {
    if (pageW <= 0) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: pageW, animated: false });
    });
  }, [pageW, selectedDate]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== pageW) setPageW(w);
  };

  const weeks = useMemo(
    () => [subWeeks(weekAnchor, 1), weekAnchor, addWeeks(weekAnchor, 1)],
    [weekAnchor],
  );

  // Three pages (prev / current / next week); landing on an edge page re-centres
  // on it, so the strip pages infinitely in both directions.
  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageW <= 0) return;
    const page = Math.round(e.nativeEvent.contentOffset.x / pageW);
    if (page === 1) return;
    setWeekAnchor((w) => (page === 0 ? subWeeks(w, 1) : addWeeks(w, 1)));
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: pageW, animated: false }));
  };

  return (
    <View onLayout={onLayout} style={styles.full}>
      {pageW > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
          alwaysBounceHorizontal={false}
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          snapToInterval={pageW}
          contentOffset={{ x: pageW, y: 0 }}
          onMomentumScrollEnd={onMomentumEnd}
          style={{ width: pageW }}>
          {weeks.map((weekStart) => {
            const days = eachDayOfInterval({
              start: weekStart,
              end: endOfWeek(weekStart, { weekStartsOn: WEEK_STARTS_ON }),
            });
            return (
              <View key={dayKey(weekStart)} style={[styles.row, { width: pageW }]}>
                {days.map((day) => (
                  <View key={dayKey(day)} style={styles.day}>
                    <Text
                      style={[
                        styles.dow,
                        { color: isToday(day) ? colors.accent : colors.textTertiary },
                      ]}>
                      {format(day, 'EEEEE')}
                    </Text>
                    <DayCell
                      day={day}
                      selected={dayKey(day) === dayKey(selectedDate)}
                      dots={dots.get(dayKey(day)) ?? []}
                      onPress={() => onSelectDate(day)}
                    />
                  </View>
                ))}
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={{ height: DAY_SIZE + 34 }} />
      )}
    </View>
  );
}

export function PlanMonthGrid({
  currentMonth,
  selectedDate,
  events = [],
  onSelectDate,
}: {
  currentMonth: Date;
  selectedDate: Date;
  events?: CalendarEvent[];
  onSelectDate: (day: Date) => void;
}) {
  const { colors } = useTheme();
  const dots = useEventDots(events, colors);
  // Full weeks (with the neighbouring months' days muted) so the grid is always
  // a clean rectangle rather than a ragged first and last row.
  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: WEEK_STARTS_ON }),
        end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: WEEK_STARTS_ON }),
      }),
    [currentMonth],
  );
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <View>
      <View style={styles.weekRow}>
        {labels.map((d, i) => (
          <Text key={`${d}-${i}`} style={[styles.dowLabel, { color: colors.textTertiary }]}>
            {d}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {days.map((day) => (
          <View key={dayKey(day)} style={styles.cell}>
            <DayCell
              day={day}
              selected={dayKey(day) === dayKey(selectedDate)}
              muted={!isSameMonth(day, currentMonth)}
              dots={dots.get(dayKey(day)) ?? []}
              onPress={() => onSelectDate(day)}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  full: { width: '100%' },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { flex: 1, alignItems: 'center', gap: 6 },
  dayInner: { alignItems: 'center', gap: 4, minHeight: DAY_SIZE + 10 },
  dow: { fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  circle: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: { fontSize: 16 },
  dots: { flexDirection: 'row', gap: 3, height: 5 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  dowLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700', letterSpacing: 0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 3 },
});
