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
import { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { CalendarEvent } from '@/types/database';

const WEEK_STARTS_ON = 0 as const;
const SCREEN_W = Dimensions.get('window').width;
const H_PAD = 20;
const PAGE_W = SCREEN_W - H_PAD * 2;
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
    <View style={styles.dayInner}>
      <Pressable
        onPress={onPress}
        hitSlop={6}
        android_ripple={{
          color: colors.accentSoft,
          borderless: true,
          radius: DAY_SIZE / 2 + 4,
        }}
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
      </Pressable>
      <View
        style={[
          styles.dot,
          { backgroundColor: hasEvents ? colors.accent : 'transparent' },
        ]}
      />
    </View>
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
  const [weekAnchor, setWeekAnchor] = useState(() =>
    startOfWeek(selectedDate, { weekStartsOn: WEEK_STARTS_ON }),
  );

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
    const page = Math.round(e.nativeEvent.contentOffset.x / PAGE_W);
    if (page === 0) {
      setWeekAnchor((w) => subWeeks(w, 1));
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: PAGE_W, animated: false }));
    } else if (page === 2) {
      setWeekAnchor((w) => addWeeks(w, 1));
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: PAGE_W, animated: false }));
    }
  };

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={PAGE_W}
      contentOffset={{ x: PAGE_W, y: 0 }}
      onMomentumScrollEnd={onMomentumEnd}
      style={{ width: PAGE_W, alignSelf: 'center' }}>
      {weeks.map((weekStart) => {
        const days = eachDayOfInterval({
          start: weekStart,
          end: endOfWeek(weekStart, { weekStartsOn: WEEK_STARTS_ON }),
        });
        return (
          <View key={weekKey(weekStart)} style={{ width: PAGE_W }}>
            <View style={styles.row}>
              {days.map((day) => {
                const selected = isSameDay(day, selectedDate);
                const hasEvents = eventDays.has(format(day, 'yyyy-MM-dd'));
                return (
                  <View key={day.toISOString()} style={styles.day}>
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
          const selected = isSameDay(day, selectedDate);
          const hasEvents = eventDays.has(format(day, 'yyyy-MM-dd'));
          return (
            <View key={day.toISOString()} style={styles.cell}>
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
  day: { flex: 1, alignItems: 'center', gap: 8 },
  dayInner: { alignItems: 'center', gap: 4, minHeight: DAY_SIZE + 9 },
  dow: { fontSize: 13, fontWeight: '600' },
  circle: {
    width: DAY_SIZE,
    height: DAY_SIZE,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  num: { fontSize: 17 },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  weekRow: { flexDirection: 'row', marginBottom: 8 },
  dowLabel: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 4 },
});
