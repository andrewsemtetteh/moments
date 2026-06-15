import { format } from 'date-fns';
import { StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui/primitives';
import { EVENT_TYPE_META, getEventTypeColors } from '@/constants/calendar-events';
import { useLiveCountdown } from '@/hooks/useLiveCountdown';
import { useTheme } from '@/hooks/useTheme';
import { formatLiveCountdownBadge } from '@/lib/event-countdown';
import type { CalendarEvent } from '@/types/database';

export function PlanEventCard({ event }: { event: CalendarEvent }) {
  const { colors } = useTheme();
  const meta = EVENT_TYPE_META[event.type];
  const tc = getEventTypeColors(event.type, colors);
  const at = new Date(event.date_time);
  const cd = useLiveCountdown(at);
  const countdown = cd ? formatLiveCountdownBadge(cd, at) : null;

  return (
    <Card style={styles.card}>
      <View style={[styles.accent, { backgroundColor: tc.main }]} />
      <View style={[styles.iconWrap, { backgroundColor: tc.soft }]}>
        <Text style={styles.emoji}>{meta.emoji}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={styles.titleRow}>
          <Text style={[styles.eventTitle, { color: colors.text }]} numberOfLines={1}>
            {event.title}
          </Text>
          {countdown && (
            <View style={[styles.countdown, { backgroundColor: tc.soft, borderColor: tc.main }]}>
              <Text style={{ color: tc.main, fontSize: 11, fontWeight: '800' }}>{countdown}</Text>
            </View>
          )}
        </View>
        <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
          {format(at, 'h:mm a')} · {meta.label}
        </Text>
        {event.description ? (
          <Text style={{ color: colors.textTertiary, fontSize: 12 }} numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, overflow: 'hidden', paddingLeft: 12 },
  accent: { width: 4, alignSelf: 'stretch', borderRadius: 2, marginLeft: -4 },
  iconWrap: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  eventTitle: { fontSize: 16, fontWeight: '800', flexShrink: 1 },
  countdown: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
