import { addDays, format, startOfWeek } from 'date-fns';
import { StyleSheet, Text, View } from 'react-native';

import { WelcomeCard } from '@/components/home/WelcomeCard';
import { Icon } from '@/components/ui/Icon';
import { MOOD_COLORS, MOOD_EMOJI, MOOD_LABELS, Radius } from '@/constants/design-system';
import { getDefaultQuickMoods } from '@/lib/mood-options';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { emptyStreakStatus } from '@/lib/streak';
import { useRelationshipStore } from '@/stores';
import type { StreakStatus, UserProfile } from '@/types/database';

/**
 * A real Home, small: the actual intro card component plus the mood card
 * (drawn exactly like Home's) and today's question, in the theme being
 * picked, so choosing a look shows exactly how the app will feel.
 */
export function ThemeHomePreview({ name, spaceName }: { name: string; spaceName?: string | null }) {
  const { colors } = useTheme();
  // Their real first name once they've joined; until then just "Partner".
  const partnerName = getFirstName(useRelationshipStore((s) => s.partner)?.name) ?? 'Partner';
  const now = new Date();
  const week = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(now, { weekStartsOn: 1 }), i))
    .filter((d) => d <= now)
    .map((d) => format(d, 'yyyy-MM-dd'));
  const status: StreakStatus = {
    ...emptyStreakStatus('preview'),
    current_streak: 12,
    longest_streak: 12,
    last_active_date: format(now, 'yyyy-MM-dd'),
    both_active_today: true,
    user_active_today: true,
    partner_active_today: true,
    active_days: week,
    activity_days: week,
  };
  const me = { id: 'me', name, avatar_url: null } as unknown as UserProfile;
  const them = { id: 'them', name: partnerName, avatar_url: null } as unknown as UserProfile;
  const surface = { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: colors.boldBorder ? 2 : 0 };

  return (
    <View style={[styles.phone, { backgroundColor: colors.background, borderColor: colors.text }]} pointerEvents="none">
      <View style={styles.header}>
        <Icon name="calendar" size={20} color={colors.text} />
        <Text style={[styles.headerText, { color: colors.text }]}>5,712 km apart · 21:40</Text>
        <Icon name="bell" size={20} color={colors.text} />
      </View>

      <View style={styles.body}>
        <WelcomeCard user={me} partner={them} spaceName={spaceName?.trim() || 'Us'} status={status} />

        <Text style={[styles.section, { color: colors.text }]}>Today</Text>
        {/* Same look as Home's MoodSnapshot: you and them, then quick moods. */}
        <View style={[styles.moodCard, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth }]}>
          <View style={styles.moodHeader}>
            <Text style={[styles.kicker, { color: colors.textSecondary }]}>How we’re feeling</Text>
            <Icon name="time" size={18} color={colors.text} />
          </View>
          <View style={styles.bubbles}>
            <MoodBubble name="Me" mood="happy" />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <MoodBubble name={partnerName} mood="loved" ago="2h ago" />
          </View>
          <View style={styles.chips}>
            {getDefaultQuickMoods(4).map((m) => {
              const on = m === 'happy';
              return (
                <View
                  key={m}
                  style={[
                    styles.chip,
                    { backgroundColor: on ? MOOD_COLORS[m] + '33' : colors.surfaceElevated, borderColor: on ? MOOD_COLORS[m] : 'transparent' },
                  ]}>
                  <Text style={styles.chipEmoji}>{MOOD_EMOJI[m]}</Text>
                  <Text style={[styles.chipText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {MOOD_LABELS[m]}
                  </Text>
                </View>
              );
            })}
            <View style={[styles.chip, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Icon name="plus" size={18} color={colors.accent} />
              <Text style={[styles.chipText, { color: colors.textSecondary }]}>More</Text>
            </View>
          </View>
        </View>
        <View style={[styles.card, surface]}>
          <Text style={[styles.kicker, { color: colors.accent }]}>Today’s question</Text>
          <Text style={[styles.question, { color: colors.text }]}>What made you smile today?</Text>
        </View>
      </View>

    </View>
  );
}

function MoodBubble({ name, mood, ago }: { name: string; mood: string; ago?: string }) {
  const { colors } = useTheme();
  const tint = MOOD_COLORS[mood];
  return (
    <View style={styles.bubble}>
      <View style={[styles.circle, { backgroundColor: tint + '2A', borderColor: tint }]}>
        <Text style={styles.circleEmoji}>{MOOD_EMOJI[mood]}</Text>
      </View>
      <Text style={[styles.bubbleName, { color: colors.text }]} numberOfLines={1}>
        {name}
      </Text>
      <Text style={[styles.bubbleMood, { color: colors.textSecondary }]} numberOfLines={1}>
        {MOOD_LABELS[mood]}
        {ago ? ` · ${ago}` : ''}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  phone: { height: 470, borderRadius: 34, borderWidth: 3, overflow: 'hidden', paddingTop: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 10 },
  headerText: { fontSize: 13, fontWeight: '800' },
  body: { paddingHorizontal: 12, gap: 10 },
  section: { fontSize: 17, fontWeight: '800', marginTop: 2 },
  card: { borderRadius: 18, padding: 12, gap: 6 },
  kicker: { fontSize: 12, fontWeight: '800' },
  moodCard: { borderRadius: Radius.lg, padding: 12 },
  moodHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  bubbles: { flexDirection: 'row', alignItems: 'center' },
  divider: { width: 1, height: 40, marginHorizontal: 8 },
  bubble: { flex: 1, alignItems: 'center', gap: 3 },
  circle: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  circleEmoji: { fontSize: 22 },
  bubbleName: { fontSize: 13, fontWeight: '700' },
  bubbleMood: { fontSize: 11 },
  chips: { flexDirection: 'row', gap: 5, marginTop: 10 },
  chip: { flex: 1, minWidth: 0, alignItems: 'center', paddingVertical: 6, borderRadius: Radius.md, borderWidth: 1.5 },
  chipEmoji: { fontSize: 16 },
  chipText: { fontSize: 9, marginTop: 1, fontWeight: '600' },
  question: { fontSize: 15, fontWeight: '800' },
});
