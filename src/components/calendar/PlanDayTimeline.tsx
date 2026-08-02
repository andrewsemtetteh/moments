import { format } from 'date-fns';
import { StyleSheet, Text, View } from 'react-native';

import { EVENT_TYPE_META, getEventTypeColors } from '@/constants/calendar-events';
import { useTheme } from '@/hooks/useTheme';
import type { CalendarEvent } from '@/types/database';

export function PlanDayTimeline({ events }: { events: CalendarEvent[] }) {
  if (events.length === 0) return null;
  return (
    <View style={styles.wrap}>
      {events.map((event, index) => (
        <TimelineRow key={event.id} event={event} isLast={index === events.length - 1} />
      ))}
    </View>
  );
}

function TimelineRow({ event, isLast }: { event: CalendarEvent; isLast: boolean }) {
  const { colors } = useTheme();
  const meta = EVENT_TYPE_META[event.type];
  const tc = getEventTypeColors(event.type, colors);
  const at = new Date(event.date_time);

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <Text style={[styles.time, { color: colors.textTertiary }]}>{format(at, 'h:mm')}</Text>
        <View style={[styles.dot, { backgroundColor: tc.main, borderColor: colors.background }]} />
        {!isLast && <View style={[styles.line, { backgroundColor: colors.border }]} />}
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: tc.main }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.emoji}>{meta.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{meta.label}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 0 },
  row: { flexDirection: 'row', gap: 12, minHeight: 72 },
  rail: { width: 48, alignItems: 'center' },
  time: { fontSize: 11, fontWeight: '700', marginBottom: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, zIndex: 1 },
  line: { width: 2, flex: 1, marginTop: 4, marginBottom: -4, borderRadius: 1 },
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  emoji: { fontSize: 20 },
  title: { fontSize: 15, fontWeight: '800' },
});
