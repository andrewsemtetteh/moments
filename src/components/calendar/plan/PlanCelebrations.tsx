import { format } from 'date-fns';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export type CelebrationItem = {
  id: string;
  emoji: string;
  title: string;
  subtitle: string;
  daysLeft: number;
};

export function PlanCelebrations({
  items,
  onPress,
}: {
  items: CelebrationItem[];
  onPress?: (item: CelebrationItem) => void;
}) {
  const { colors } = useTheme();
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, { color: colors.text }]}>Upcoming Celebrations</Text>
      <View style={styles.list}>
        {items.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onPress?.(item)}
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.iconWrap, { backgroundColor: colors.accentSoft }]}>
              <Text style={styles.emoji}>{item.emoji}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>{item.subtitle}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: colors.accentSoft }]}>
              <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 13 }}>
                {item.daysLeft === 0 ? 'Today' : `${item.daysLeft}d`}
              </Text>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function celebrationSubtitle(date: Date, daysLeft: number) {
  if (daysLeft === 0) return `Today · ${format(date, 'MMM d')}`;
  if (daysLeft === 1) return `Tomorrow · ${format(date, 'MMM d')}`;
  return format(date, 'EEEE, MMM d');
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, gap: 14 },
  heading: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  title: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 13, fontWeight: '500' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
});
