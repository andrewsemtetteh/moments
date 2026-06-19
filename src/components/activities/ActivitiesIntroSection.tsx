import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import type { ExploreModalKey } from '@/components/activities/ExploreSection';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';

const QUICK_PICKS: { key: ExploreModalKey; label: string; icon: IconName }[] = [
  { key: 'cards', label: 'Cards', icon: 'cards' },
  { key: 'games', label: 'Games', icon: 'gamepad' },
  { key: 'quizLive', label: 'Quiz Live', icon: 'globe' },
];

const QUICK_GAP = Spacing.sm;
const SCREEN_PAD = Spacing.lg;

interface ActivitiesIntroSectionProps {
  challengePrompt?: string | null;
  partnerName?: string | null;
  onQuickOpen: (key: ExploreModalKey) => void;
}

export function ActivitiesIntroSection({
  challengePrompt,
  partnerName,
  onQuickOpen,
}: ActivitiesIntroSectionProps) {
  const { colors } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const contentWidth = windowWidth - SCREEN_PAD * 2;
  const panelInnerWidth = contentWidth - 32;
  const quickTileWidth = (panelInnerWidth - QUICK_GAP * 2) / 3;
  const partnerFirst = getFirstName(partnerName) ?? 'your partner';

  const open = (key: ExploreModalKey) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onQuickOpen(key);
  };

  return (
    <View style={styles.section}>
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <View style={styles.heroGlow} pointerEvents="none" />
        <View style={styles.heroRow}>
          <View style={styles.heroIcon}>
            <Icon name="gamepad" size={26} color="#fff" filled />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>PLAY TOGETHER</Text>
            <Text style={styles.heroTitle}>We&apos;re bored?</Text>
            <Text style={styles.heroSub}>
              Pick something fun for you and {partnerFirst} below.
            </Text>
          </View>
        </View>

        {challengePrompt ? (
          <Pressable onPress={() => open('daily')} style={styles.challengeCard}>
            <View style={styles.challengeHeader}>
              <Icon name="sparkles" size={14} color="rgba(255,255,255,0.9)" />
              <Text style={styles.challengeLabel}>Today&apos;s challenge</Text>
            </View>
            <Text style={styles.challengeText}>{challengePrompt}</Text>
          </Pressable>
        ) : null}
      </LinearGradient>

      <View
        style={[
          styles.quickPanel,
          { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
        ]}>
        <Text style={[styles.quickLabel, { color: colors.textSecondary }]}>Jump in</Text>
        <View style={styles.quickGrid}>
          {QUICK_PICKS.map((pick) => (
            <Pressable
              key={pick.key}
              onPress={() => open(pick.key)}
              style={[
                styles.quickTile,
                { width: quickTileWidth, backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              <View style={[styles.quickIcon, { backgroundColor: colors.accentSoft }]}>
                <Icon name={pick.icon} size={20} color={colors.accent} filled />
              </View>
              <Text style={[styles.quickTitle, { color: colors.text }]} numberOfLines={1}>
                {pick.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 6 },
  hero: {
    borderRadius: 24,
    padding: 20,
    paddingBottom: 28,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.12)',
    top: -60,
    right: -40,
  },
  heroRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1, gap: 4 },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
    marginTop: 2,
  },
  challengeCard: {
    marginTop: 18,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.16)',
    gap: 8,
  },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  challengeLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  challengeText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 23,
    fontWeight: '600',
  },
  quickPanel: {
    marginTop: -18,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  quickLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  quickGrid: {
    flexDirection: 'row',
    gap: QUICK_GAP,
    justifyContent: 'space-between',
  },
  quickTile: {
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    minHeight: 88,
  },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickTitle: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
});
