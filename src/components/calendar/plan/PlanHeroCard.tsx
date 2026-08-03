import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primitives';
import { planCountdownLabel, planCoverGradient, planTypeEmoji, planWhenLabel } from '@/lib/plan-format';
import { useTheme } from '@/hooks/useTheme';
import type { CalendarEvent } from '@/types/database';

export function PlanHeroCard({
  event,
  onCreateDate,
  onPressEvent,
}: {
  event: CalendarEvent | null;
  onCreateDate: () => void;
  onPressEvent?: (event: CalendarEvent) => void;
}) {
  const { colors } = useTheme();

  if (!event) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <LinearGradient
          colors={[colors.accentSoft, 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={[styles.emptyEyebrow, { color: colors.accent }]}>Closer, every day</Text>
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Plan Something Together</Text>
        <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
          Every memory starts with one plan.
        </Text>
        <PrimaryButton label="Create a Date" onPress={onCreateDate} style={{ marginTop: 8, alignSelf: 'stretch' }} />
      </View>
    );
  }

  const at = new Date(event.date_time);
  const gradient = planCoverGradient(event.type);

  return (
    <Pressable onPress={() => onPressEvent?.(event)} style={[styles.hero, { shadowColor: colors.shadow }]}>
      <LinearGradient colors={gradient} style={StyleSheet.absoluteFill} start={{ x: 0.1, y: 0 }} end={{ x: 1, y: 1 }} />
      <Image
        source={{ uri: heroImageFor(event) }}
        style={styles.image}
        contentFit="cover"
        transition={200}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.15)', 'rgba(20,10,14,0.88)']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.content}>
        <Text style={styles.eyebrow}>
          {planTypeEmoji(event.type, event.title)} Next Together
        </Text>
        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>
        <Text style={styles.when}>{planWhenLabel(at)}</Text>
        {event.description ? (
          <Text style={styles.place} numberOfLines={1}>
            {event.description}
          </Text>
        ) : null}
        <View style={styles.countdownPill}>
          <Text style={styles.countdownLabel}>Countdown</Text>
          <Text style={styles.countdownValue}>{planCountdownLabel(at)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

function heroImageFor(event: CalendarEvent): string {
  if (event.type === 'experience') {
    return 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=1200&q=80';
  }
  if (event.type === 'anniversary') {
    return 'https://images.unsplash.com/photo-1519741497674-611481863552?w=1200&q=80';
  }
  return 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1200&q=80';
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: 20,
    height: 280,
    borderRadius: 28,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 20,
    elevation: 6,
  },
  image: { ...StyleSheet.absoluteFill, opacity: 0.55 },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    padding: 22,
    gap: 6,
  },
  eyebrow: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  title: { color: '#FFF', fontSize: 28, fontWeight: '800', letterSpacing: -0.6 },
  when: { color: 'rgba(255,255,255,0.82)', fontSize: 15, fontWeight: '600' },
  place: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '500' },
  countdownPill: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 2,
  },
  countdownLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  countdownValue: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  empty: {
    marginHorizontal: 20,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    gap: 8,
    overflow: 'hidden',
    minHeight: 220,
    justifyContent: 'flex-end',
  },
  emptyEyebrow: { fontSize: 12, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  emptyTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  emptyBody: { fontSize: 15, lineHeight: 22, marginBottom: 4 },
});
