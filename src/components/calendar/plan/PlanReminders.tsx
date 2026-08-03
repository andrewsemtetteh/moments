import { Pressable, StyleSheet, Text, View } from 'react-native';

import { planTypeEmoji, planWhenLabel } from '@/lib/plan-format';
import { useTheme } from '@/hooks/useTheme';
import type { CalendarEvent } from '@/types/database';

export function PlanReminders({
  reminders,
  onPress,
}: {
  reminders: CalendarEvent[];
  onPress?: (event: CalendarEvent) => void;
}) {
  const { colors } = useTheme();
  if (reminders.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text }]}>Shared Reminders</Text>
      <View style={styles.grid}>
        {reminders.slice(0, 6).map((event) => (
          <Pressable
            key={event.id}
            onPress={() => onPress?.(event)}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.emoji}>{planTypeEmoji(event.type, event.title)}</Text>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {event.title}
            </Text>
            <Text style={[styles.meta, { color: colors.textTertiary }]} numberOfLines={1}>
              {planWhenLabel(new Date(event.date_time))}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, gap: 14 },
  heading: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '48%',
    flexGrow: 1,
    minWidth: '46%',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 6,
  },
  emoji: { fontSize: 22 },
  title: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 12, fontWeight: '600' },
});
