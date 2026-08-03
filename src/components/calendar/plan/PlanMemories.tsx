import { Pressable, StyleSheet, Text, View } from 'react-native';

import { planDayLabel, planTypeEmoji } from '@/lib/plan-format';
import { openChat } from '@/lib/router';
import { useTheme } from '@/hooks/useTheme';
import type { CalendarEvent } from '@/types/database';

export function PlanMemories({ events }: { events: CalendarEvent[] }) {
  const { colors } = useTheme();
  if (events.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text }]}>Memories</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>
        Finished plans become stories you keep.
      </Text>
      <View style={styles.list}>
        {events.slice(0, 4).map((event) => {
          const at = new Date(event.date_time);
          return (
            <View
              key={event.id}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={styles.emoji}>{planTypeEmoji(event.type, event.title)}</Text>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {event.title}
                </Text>
                <Text style={[styles.meta, { color: colors.textTertiary }]}>{planDayLabel(at)}</Text>
              </View>
              <Pressable
                onPress={() => openChat(`Remembering ${event.title}…`)}
                style={[styles.action, { backgroundColor: colors.accentSoft }]}>
                <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 12 }}>Write</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, gap: 8 },
  heading: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  sub: { fontSize: 14, marginBottom: 6 },
  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  emoji: { fontSize: 24 },
  title: { fontSize: 16, fontWeight: '800' },
  meta: { fontSize: 12, fontWeight: '600' },
  action: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
});
