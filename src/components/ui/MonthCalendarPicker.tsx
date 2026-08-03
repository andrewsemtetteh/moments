import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
} from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export type CalendarDayMarker = {
  dateKey: string;
  times: string[];
};

function dateKey(day: Date) {
  return format(startOfDay(day), 'yyyy-MM-dd');
}

export function MonthCalendarPicker({
  value,
  onChange,
  minDate = startOfDay(new Date()),
  maxDate,
  markers = [],
}: {
  value: Date;
  /** @deprecated unused — kept for call-site compat */
  selectedDateTime?: Date;
  onChange: (day: Date) => void;
  minDate?: Date | null;
  maxDate?: Date;
  markers?: CalendarDayMarker[];
}) {
  const { colors } = useTheme();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(value));

  useEffect(() => {
    setCurrentMonth(startOfMonth(value));
  }, [value]);

  const markerByDay = new Map(markers.map((m) => [m.dateKey, m]));
  const monthStart = startOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(currentMonth) });
  const min = minDate ? startOfDay(minDate) : null;
  const max = maxDate ? startOfDay(maxDate) : null;

  const canGoNext = !max || !isAfter(startOfMonth(addMonths(currentMonth, 1)), startOfMonth(max));

  const isDisabled = (day: Date) =>
    (min ? isBefore(day, min) : false) || (max ? isAfter(day, max) : false);

  const selectDay = (day: Date) => {
    if (isDisabled(day)) return;
    Haptics.selectionAsync();
    setCurrentMonth(startOfMonth(day));
    onChange(day);
  };

  const shiftMonth = (delta: number) => {
    if (delta > 0 && !canGoNext) return;
    Haptics.selectionAsync();
    setCurrentMonth(addMonths(currentMonth, delta));
  };

  return (
    <View>
      <View style={styles.monthHeader}>
        <Pressable
          onPress={() => shiftMonth(-1)}
          accessibilityLabel="Previous month"
          hitSlop={8}
          style={[styles.navBtn, { backgroundColor: colors.surfaceElevated }]}>
          <Icon name="chevronLeft" size={20} color={colors.text} />
        </Pressable>
        <Text style={[styles.monthTitle, { color: colors.text }]}>{format(currentMonth, 'MMMM yyyy')}</Text>
        <Pressable
          onPress={() => shiftMonth(1)}
          disabled={!canGoNext}
          accessibilityLabel="Next month"
          hitSlop={8}
          style={[styles.navBtn, { backgroundColor: colors.surfaceElevated, opacity: canGoNext ? 1 : 0.35 }]}>
          <Icon name="chevronRight" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekDays}>
        {WEEK_DAYS.map((d, i) => (
          <Text key={i} style={[styles.weekDay, { color: colors.textTertiary }]}>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {Array.from({ length: monthStart.getDay() }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.dayCell} />
        ))}
        {days.map((day) => {
          const disabled = isDisabled(day);
          const isSelected = isSameDay(day, value);
          const isToday = isSameDay(day, new Date());
          const marker = markerByDay.get(dateKey(day));
          const hasMarker = (marker?.times.length ?? 0) > 0;

          return (
            <Pressable
              key={day.toISOString()}
              onPress={() => selectDay(day)}
              disabled={disabled}
              style={styles.dayCell}>
              <View
                style={[
                  styles.dayInner,
                  isSelected && { backgroundColor: colors.accent },
                  !isSelected && isToday && { borderColor: colors.accent, borderWidth: 1.5 },
                  disabled && { opacity: 0.3 },
                ]}>
                <Text
                  style={[
                    styles.dayNum,
                    {
                      color: isSelected
                        ? colors.onAccent
                        : isSameMonth(day, currentMonth)
                          ? colors.text
                          : colors.textTertiary,
                      fontWeight: isSelected || isToday ? '700' : '500',
                    },
                  ]}>
                  {format(day, 'd')}
                </Text>
              </View>
              {hasMarker && !isSelected ? (
                <View style={[styles.dot, { backgroundColor: colors.accent }]} />
              ) : (
                <View style={styles.dotSpace} />
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  monthHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthTitle: { fontSize: 16, fontWeight: '700' },
  weekDays: { flexDirection: 'row', marginBottom: 6 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: '14.2857%', alignItems: 'center', paddingVertical: 2 },
  dayInner: {
    width: 36,
    height: 36,
    borderRadius: 999,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: { fontSize: 15 },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 3 },
  dotSpace: { height: 7 },
});
