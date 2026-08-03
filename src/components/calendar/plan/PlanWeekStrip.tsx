import {
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subWeeks,
} from 'date-fns';
import * as Haptics from 'expo-haptics';
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

import { useTheme } from '@/hooks/useTheme';
import type { CalendarEvent } from '@/types/database';

const WEEK_STARTS_ON = 0 as const;
/** Shared selected-day circle size for week + month. */
const DAY_SIZE = 40;

function weekKey(anchor: Date) {
  return format(startOfWeek(anchor, { weekStartsOn: WEEK_STARTS_ON }), 'yyyy-MM-dd');
}

function DayCircle({
  day,
  selected,
  muted,
  hasEvents,
  onPress,
}: {
  day: Date;
  selected: boolean;
  muted?: boolean;
  hasEvents: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const today = isToday(day);

  return (
    <Pressable onPress={onPress} hitSlop={6} style={styles.dayInner} accessibilityRole="button">
      <View
        style={[
          styles.circle,
          selected && { backgroundColor: colors.accent },
          !selected && today && { borderWidth: 1.5, borderColor: colors.accent },
        ]}>
        <Text
          style={[
            styles.num,
            {
              color: selected
                ? colors.onAccent
                : muted
                  ? colors.textTertiary
                  : colors.text,
              fontWeight: selected || today ? '700' : '500',
            },
          ]}>
          {format(day, 'd')}
        </Text>
      </View>
      <View
        style={[
          styles.underMark,
          selected
            ? { backgroundColor: colors.accent, width: 6, height: 6, borderRadius: 3 }
            : { backgroundColor: hasEvents ? colors.accent : 'transparent' },
        ]}
      />
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

  // Keep the strip on the week that contains the selected day (chevrons, create, month jumps).
  useEffect(() => {
    const next = startOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON });
    setWeekAnchor((prev) => (isSameDay(prev, next) ? prev : next));
    if (pageW <= 0) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x: pageW, animated: false });
    });
  }, [pageW, selectedDate]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (w > 0 && w !== pageW) setPageW(w);
  };

  const eventDays = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(format(new Date(e.date_time), 'yyyy-MM-dd'));
    return set;
  }, [events]);

  const weeks = useMemo(() => {
    const center = weekAnchor;
    return [subWeeks(center, 1), center, addWeeks(center, 1)];
  }, [weekAnchor]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageW <= 0) return;
    const page = Math.round(e.nativeEvent.contentOffset.x / pageW);
    if (page === 0) {
      setWeekAnchor((w) => subWeeks(w, 1));
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: pageW, animated: false }));
    } else if (page === 2) {
      setWeekAnchor((w) => addWeeks(w, 1));
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: pageW, animated: false }));
    }
  };

  return (
    <View onLayout={onLayout} style={{ width: '100%' }}>
      {pageW > 0 ? (
        <ScrollView
          ref={scrollRef}
          horizontal
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
              <View key={weekKey(weekStart)} style={{ width: pageW }}>
                <View style={styles.row}>
                  {days.map((day) => {
                    const selected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
                    const hasEvents = eventDays.has(format(day, 'yyyy-MM-dd'));
                    return (
                      <View key={format(day, 'yyyy-MM-dd')} style={styles.day}>
                        <Text style={[styles.dow, { color: colors.textTertiary }]}>
                          {format(day, 'EEEEE')}
                        </Text>
                        <DayCircle
                          day={day}
                          selected={selected}
                          hasEvents={hasEvents}
                          onPress={() => {
                            Haptics.selectionAsync();
                            onSelectDate(day);
                          }}
                        />
                      </View>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </ScrollView>
      ) : (
        <View style={{ height: DAY_SIZE + 28 }} />
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
  const monthStart = startOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(currentMonth) });
  const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const eventDays = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) set.add(format(new Date(e.date_time), 'yyyy-MM-dd'));
    return set;
  }, [events]);

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
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <View key={`e-${i}`} style={styles.cell} />
        ))}
        {days.map((day) => {
          const selected = format(day, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
          const hasEvents = eventDays.has(format(day, 'yyyy-MM-dd'));
          return (
            <View key={format(day, 'yyyy-MM-dd')} style={styles.cell}>
              <DayCircle
                day={day}
                selected={selected}
                muted={!isSameMonth(day, currentMonth)}
                hasEvents={hasEvents}
                onPress={() => {
                  Haptics.selectionAsync();
                  onSelectDate(day);
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  day: { flex: 1, alignItems: 'center', gap: 6 },
  dayInner: { alignItems: 'center', gap: 5, minHeight: DAY_SIZE + 12 },
  dow: { fontSize: 13, fontWeight: '600' },
  circle: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: DAY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: { fontSize: 17 },
  underMark: { width: 5, height: 5, borderRadius: 2.5 },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  dowLabel: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 4 },
});
