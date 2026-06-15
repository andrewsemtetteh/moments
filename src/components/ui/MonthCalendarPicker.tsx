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
import { useState } from 'react';
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
  selectedDateTime,
  onChange,
  minDate = startOfDay(new Date()),
  maxDate,
  markers = [],
}: {
  value: Date;
  selectedDateTime?: Date;
  onChange: (day: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  markers?: CalendarDayMarker[];
}) {
  const { colors } = useTheme();
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(value));

  const markerByDay = new Map(markers.map((m) => [m.dateKey, m]));
  const selection = selectedDateTime ?? value;
  const selectedTimeLabel = format(selection, 'h:mm a');
  const selectionVisible = isSameMonth(selection, currentMonth);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const min = startOfDay(minDate);
  const max = maxDate ? startOfDay(maxDate) : null;

  const canGoPrev = !isBefore(startOfMonth(addMonths(currentMonth, -1)), startOfMonth(min));
  const canGoNext = !max || !isAfter(startOfMonth(addMonths(currentMonth, 1)), startOfMonth(max));

  const isDisabled = (day: Date) => isBefore(day, min) || (max ? isAfter(day, max) : false);

  const jumpToSelection = () => {
    Haptics.selectionAsync();
    setCurrentMonth(startOfMonth(selection));
  };

  const selectDay = (day: Date) => {
    if (isDisabled(day)) return;
    Haptics.selectionAsync();
    setCurrentMonth(startOfMonth(day));
    onChange(day);
  };

  const shiftMonth = (delta: number) => {
    const next = addMonths(currentMonth, delta);
    if (delta < 0 && !canGoPrev) return;
    if (delta > 0 && !canGoNext) return;
    Haptics.selectionAsync();
    setCurrentMonth(next);
  };

  return (
    <View>
      <View style={styles.monthHeader}>
        <Pressable
          onPress={() => shiftMonth(-1)}
          disabled={!canGoPrev}
          style={[styles.navBtn, { backgroundColor: colors.surfaceElevated, opacity: canGoPrev ? 1 : 0.3 }]}>
          <Icon name="chevronLeft" size={18} color={colors.text} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={[styles.monthTitle, { color: colors.text }]}>{format(currentMonth, 'MMMM yyyy')}</Text>
          {!selectionVisible && (
            <Pressable onPress={jumpToSelection}>
              <Text style={{ color: colors.accent, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                Jump to {format(selection, 'MMM d')} ↓
              </Text>
            </Pressable>
          )}
        </View>
        <Pressable
          onPress={() => shiftMonth(1)}
          disabled={!canGoNext}
          style={[styles.navBtn, { backgroundColor: colors.surfaceElevated, opacity: canGoNext ? 1 : 0.3 }]}>
          <Icon name="chevronRight" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekDays}>
        {WEEK_DAYS.map((d, i) => (
          <Text key={i} style={[styles.weekDay, { color: colors.textTertiary }]}>{d}</Text>
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
          const allocatedTimes = marker?.times ?? [];

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
                <Text style={[
                  styles.dayNum,
                  {
                    color: isSelected
                      ? colors.onAccent
                      : isSameMonth(day, currentMonth)
                        ? colors.text
                        : colors.textTertiary,
                  },
                ]}>
                  {format(day, 'd')}
                </Text>
                {isSelected && (
                  <Text style={[styles.dayTime, { color: colors.onAccent }]} numberOfLines={1}>
                    {selectedTimeLabel}
                  </Text>
                )}
              </View>
              {allocatedTimes.length > 0 && !isSelected && (
                <View style={styles.dotsRow}>
                  {allocatedTimes.slice(0, 3).map((t, i) => (
                    <View key={`${t}-${i}`} style={[styles.dot, { backgroundColor: colors.accent }]} />
                  ))}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  navBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  monthTitle: { fontSize: 16, fontWeight: '800' },
  weekDays: { flexDirection: 'row', marginBottom: 4 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: { width: `${100 / 7}%`, minHeight: 52, alignItems: 'center', paddingTop: 2 },
  dayInner: { width: 40, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingVertical: 3 },
  dayNum: { fontSize: 14, fontWeight: '600', lineHeight: 17 },
  dayTime: { fontSize: 8, fontWeight: '800', lineHeight: 10, marginTop: 1 },
  dotsRow: { flexDirection: 'row', gap: 2, marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
});
