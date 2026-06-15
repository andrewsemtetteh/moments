import { isSameMonth } from 'date-fns';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { CalendarEvent } from '@/types/database';

export function PlanMonthInsights({
  events,
  currentMonth,
  plansAhead,
}: {
  events: CalendarEvent[];
  currentMonth: Date;
  plansAhead: number;
}) {
  const { colors } = useTheme();
  const monthEvents = events.filter((e) => isSameMonth(new Date(e.date_time), currentMonth));
  const dates = monthEvents.filter((e) => e.type === 'date').length;
  const experiences = monthEvents.filter((e) => e.type === 'experience').length;

  if (monthEvents.length === 0 && plansAhead === 0) return null;

  return (
    <View style={styles.row}>
      <InsightChip label={`${monthEvents.length} this month`} colors={colors} />
      {dates > 0 && <InsightChip label={`${dates} date${dates > 1 ? 's' : ''}`} colors={colors} accent />}
      {experiences > 0 && <InsightChip label={`${experiences} experiences`} colors={colors} />}
      {plansAhead > 0 && <InsightChip label={`${plansAhead} ahead`} colors={colors} accent />}
    </View>
  );
}

function InsightChip({
  label,
  colors,
  accent,
}: {
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
  accent?: boolean;
}) {
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: accent ? colors.accentSoft : colors.surfaceElevated,
          borderColor: accent ? colors.accent : colors.border,
        },
      ]}>
      <Text style={{ color: accent ? colors.accent : colors.textSecondary, fontSize: 11, fontWeight: '700' }}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 0 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
