import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import type { CalendarEvent } from '@/types/database';

const WEEK_DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

export function PlanMonthExpand({
  visible,
  currentMonth,
  selectedDate,
  events,
  onChangeMonth,
  onSelectDate,
  onClose,
}: {
  visible: boolean;
  currentMonth: Date;
  selectedDate: Date;
  events: CalendarEvent[];
  onChangeMonth: (month: Date) => void;
  onSelectDate: (day: Date) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  if (!visible) return null;

  const monthStart = startOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: endOfMonth(currentMonth) });

  const hasEvent = (day: Date) => events.some((e) => isSameDay(new Date(e.date_time), day));

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => onChangeMonth(addMonths(currentMonth, -1))}
          style={[styles.nav, { backgroundColor: colors.surfaceElevated }]}>
          <Icon name="chevronLeft" size={18} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>{format(currentMonth, 'MMMM yyyy')}</Text>
        <Pressable
          onPress={() => onChangeMonth(addMonths(currentMonth, 1))}
          style={[styles.nav, { backgroundColor: colors.surfaceElevated }]}>
          <Icon name="chevronRight" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEK_DAYS.map((d, i) => (
          <Text key={i} style={[styles.weekDay, { color: colors.textTertiary }]}>
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
          const today = isSameDay(day, new Date());
          const marked = hasEvent(day);
          return (
            <Pressable
              key={day.toISOString()}
              onPress={() => {
                Haptics.selectionAsync();
                onSelectDate(day);
                onClose();
              }}
              style={styles.cell}>
              <View
                style={[
                  styles.dayInner,
                  selected && { backgroundColor: colors.accent },
                  today && !selected && { borderColor: colors.accent, borderWidth: 1.5 },
                ]}>
                <Text
                  style={{
                    color: selected
                      ? colors.onAccent
                      : isSameMonth(day, currentMonth)
                        ? colors.text
                        : colors.textTertiary,
                    fontWeight: selected || today || marked ? '800' : '500',
                    fontSize: 14,
                  }}>
                  {format(day, 'd')}
                </Text>
              </View>
              {marked ? <View style={[styles.dot, { backgroundColor: selected ? colors.onAccent : colors.accent }]} /> : <View style={styles.dotSpace} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 8,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  nav: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800' },
  weekRow: { flexDirection: 'row', marginBottom: 6 },
  weekDay: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.2857%', alignItems: 'center', paddingVertical: 2 },
  dayInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 2 },
  dotSpace: { height: 6, marginTop: 2 },
});
