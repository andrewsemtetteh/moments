import { addDays, format, startOfWeek, subHours } from 'date-fns';
import { StyleSheet, Text, View } from 'react-native';

import { MoodSnapshot } from '@/components/home/MoodSnapshot';
import { introBand, WelcomeCard } from '@/components/home/WelcomeCard';
import { Icon } from '@/components/ui/Icon';
import { cardSurface, outlineColor } from '@/components/ui/primitives';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { emptyStreakStatus } from '@/lib/streak';
import { useRelationshipStore } from '@/stores';
import type { StreakStatus, UserProfile } from '@/types/database';

const noop = () => undefined;

/**
 * A real Home, small: the header on the intro band, the band itself and Home's own mood card
 * (the same components, with sample moods), then today's question, in the theme being picked,
 * so choosing a look shows exactly how the app will feel.
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
  const band = introBand(colors);

  return (
    <View style={[styles.phone, { backgroundColor: colors.background, borderColor: outlineColor(colors) }]} pointerEvents="none">
      {/* As on Home: the header sits on the intro band, in the band's own ink. */}
      <View style={[styles.header, { backgroundColor: band.background }]}>
        <Icon name="calendar" size={20} color={band.ink} />
        <Text style={[styles.headerText, { color: band.ink }]}>5,712 km Away · 21:40</Text>
        <Icon name="bell" size={20} color={band.ink} />
      </View>

      <View style={styles.body}>
        <WelcomeCard user={me} partner={them} spaceName={spaceName?.trim() || 'Us'} status={status} band />

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, colors.sticker && styles.sectionTitleSticker, { color: colors.text }]}>Today</Text>
          <MoodSnapshot
            moods={{}}
            onSelectMood={noop}
            onViewHistory={noop}
            sample={{ partnerName, myMood: 'happy', partnerMood: 'loved', partnerSetAt: subHours(now, 2).toISOString() }}
          />
          <View style={[styles.card, cardSurface(colors)]}>
            <Text style={[styles.kicker, { color: colors.accent }]}>Today’s question</Text>
            <Text style={[styles.question, { color: colors.text }]}>What made you smile today?</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  phone: { height: 470, borderRadius: 34, borderWidth: 1.5, overflow: 'hidden' },
  // Above the band's fill (which reaches up behind it, as on Home).
  header: {
    zIndex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
  },
  headerText: { fontSize: 13, fontWeight: '800' },
  // Home's own page padding, so the band reaches the edges exactly as there.
  body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs, gap: Spacing.md },
  section: { gap: Spacing.md },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sectionTitleSticker: { fontWeight: '900', letterSpacing: -0.4 },
  card: { borderRadius: 18, padding: 14, gap: 6 },
  kicker: { fontSize: 12, fontWeight: '800' },
  question: { fontSize: 15, fontWeight: '800' },
});
