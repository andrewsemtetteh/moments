import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { planCountdownLabel, planCoverGradient, planDayLabel, planTypeEmoji } from '@/lib/plan-format';
import { useTheme } from '@/hooks/useTheme';
import type { CalendarEvent } from '@/types/database';
import { format } from 'date-fns';

export function PlanComingUp({
  events,
  onPressEvent,
}: {
  events: CalendarEvent[];
  onPressEvent?: (event: CalendarEvent) => void;
}) {
  const { colors } = useTheme();
  if (events.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text }]}>Coming Up</Text>
      <View style={styles.list}>
        {events.map((event, index) => {
          const at = new Date(event.date_time);
          const gradient = planCoverGradient(event.type);
          return (
            <View key={event.id} style={styles.row}>
              <View style={styles.rail}>
                <View style={[styles.railDot, { backgroundColor: colors.accent, borderColor: colors.background }]} />
                {index < events.length - 1 ? (
                  <View style={[styles.railLine, { backgroundColor: colors.border }]} />
                ) : null}
              </View>
              <Pressable
                onPress={() => onPressEvent?.(event)}
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, shadowColor: colors.shadow }]}>
                <LinearGradient colors={gradient} style={styles.cover} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                  <Text style={styles.coverEmoji}>{planTypeEmoji(event.type, event.title)}</Text>
                </LinearGradient>
                <View style={styles.body}>
                  <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
                    {event.title}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {planDayLabel(at)} · {format(at, 'h:mm a')}
                  </Text>
                  {event.description ? (
                    <Text style={[styles.place, { color: colors.textTertiary }]} numberOfLines={1}>
                      {event.description}
                    </Text>
                  ) : null}
                  <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
                    <Text style={{ color: colors.accent, fontSize: 12, fontWeight: '700' }}>
                      {planCountdownLabel(at)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, gap: 14 },
  heading: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  list: { gap: 0 },
  row: { flexDirection: 'row', gap: 12, minHeight: 120 },
  rail: { width: 16, alignItems: 'center' },
  railDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, marginTop: 28, zIndex: 1 },
  railLine: { width: 2, flex: 1, marginTop: 4, marginBottom: -4 },
  card: {
    flex: 1,
    flexDirection: 'row',
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 14,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
  },
  cover: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmoji: { fontSize: 28 },
  body: { flex: 1, padding: 14, gap: 4, justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  meta: { fontSize: 13, fontWeight: '600' },
  place: { fontSize: 12, fontWeight: '500' },
  badge: {
    alignSelf: 'flex-start',
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
});
