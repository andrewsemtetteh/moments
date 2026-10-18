import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LevelRing } from '@/components/games/PlayHub';
import { StickerFlame } from '@/components/home/StickerFlame';
import { useStreak } from '@/hooks/queries';
import { PlayHeader } from '@/components/play/PlayHeader';
import { ShareCardModal } from '@/components/share/ShareCardModal';
import { TitleShareCard } from '@/components/share/TitleShareCard';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar, colorWithAlpha, outlineColor, separatorColor, trackColor } from '@/components/ui/primitives';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import {
  BADGES,
  emptyProgress,
  levelInfo,
  nextBadges,
  TITLE_TIERS,
  todayKey,
  xpForLevel,
} from '@/lib/play-progress';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { usePlayProgressStore } from '@/stores/play-progress-store';

/** Levels per title tier (Sweethearts I–V). Matches lib/play-progress. */
const LEVELS_PER_TIER = 5;

/** Everything you two have done, in the order it's worth reading. */
const STATS: { key: string; label: string; icon: IconName }[] = [
  { key: 'games_played', label: 'Games played', icon: 'gamepad' },
  { key: 'live_games', label: 'Live games', icon: 'volumeHigh' },
  { key: 'sync_matches', label: 'Answers matched', icon: 'sync' },
  { key: 'truths_done', label: 'Truths told', icon: 'chat' },
  { key: 'dares_done', label: 'Dares done', icon: 'fire' },
  { key: 'guesses_correct', label: 'Answers guessed', icon: 'eye' },
  { key: 'quiz_correct', label: 'Quiz answers right', icon: 'target' },
  { key: 'daily_answers', label: 'Daily questions', icon: 'question' },
  { key: 'pack_answers', label: 'Pack answers', icon: 'cards' },
  { key: 'packs_completed', label: 'Packs finished', icon: 'checkDone' },
  { key: 'moments_sent', label: 'Moments sent', icon: 'camera' },
  { key: 'together_done', label: 'Done together', icon: 'people' },
];

/**
 * The Play page's progress card, opened up: your level and what's next, every
 * title on the road, your play streak, all your numbers and the trophies closest
 * to unlocking.
 */
export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const stored = usePlayProgressStore((s) => s.progress);
  const progress = stored ?? emptyProgress(todayKey());
  const info = useMemo(() => levelInfo(progress.xp), [progress.xp]);
  // Your streak (the one on Home, You and the streak page), not the separate play count.
  const { data: streakStatus } = useStreak();
  const streak = streakStatus?.current_streak ?? 0;
  const streakBest = Math.max(streakStatus?.longest_streak ?? 0, streak);
  const chase = useMemo(() => nextBadges(progress, 4), [progress]);
  // A title from The road being shared.
  const [sharing, setSharing] = useState<{ title: string; line: string } | null>(null);
  const currentTier = Math.floor((info.level - 1) / LEVELS_PER_TIER);
  const card = {
    backgroundColor: colors.isDark ? colors.surface : colors.surfaceElevated,
    borderColor: outlineColor(colors),
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <View style={{ backgroundColor: colors.background }}>
          <PlayHeader title="Your progress" />
        </View>

        <View style={styles.body}>
          {/* Level: the ring, the title, and exactly how far to the next one. */}
          <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <View style={styles.heroAvatars}>
              <Avatar name={user?.name} imageUrl={user?.avatar_url} size={34} />
              <View style={styles.overlap}>
                <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={34} />
              </View>
            </View>
            <LevelRing level={info.level} progress={info.progress} />
            <Text style={[styles.heroEyebrow, { color: colorWithAlpha(colors.onAccent, 0.8) }]}>YOUR COUPLE LEVEL</Text>
            <Text style={[styles.heroTitle, { color: colors.onAccent }]} numberOfLines={1} adjustsFontSizeToFit>
              {info.title}
            </Text>
            <View style={[styles.heroTrack, { backgroundColor: colorWithAlpha(colors.onAccent, 0.25) }]}>
              <View
                style={[
                  styles.heroFill,
                  { width: `${Math.round(info.progress * 100)}%`, backgroundColor: colors.onAccent },
                ]}
              />
            </View>
            <Text style={[styles.heroXp, { color: colorWithAlpha(colors.onAccent, 0.9) }]}>
              {info.into.toLocaleString()} / {info.span.toLocaleString()} XP ·{' '}
              {(info.span - info.into).toLocaleString()} to {info.nextTitle}
            </Text>
          </LinearGradient>

          {/* The three headline numbers. */}
          <View style={styles.trio}>
            <View style={[styles.trioCell, card]}>
              <View style={styles.trioIcon}>
                <Icon name="star" size={22} color={colors.accent} filled />
              </View>
              <Text style={[styles.trioValue, { color: colors.text }]}>{progress.xp.toLocaleString()}</Text>
              <Text style={[styles.trioLabel, { color: colors.textSecondary }]}>Total XP</Text>
            </View>
            <View style={[styles.trioCell, card]}>
              {/* Your streak: the same number as Home and the streak page. */}
              <View style={[styles.trioIcon, streak > 0 ? undefined : styles.idleFlame]}>
                <StickerFlame size={20} />
              </View>
              <Text style={[styles.trioValue, { color: colors.text }]}>{streak}</Text>
              <Text style={[styles.trioLabel, { color: colors.textSecondary }]}>
                Day streak · best {streakBest}
              </Text>
            </View>
            <View style={[styles.trioCell, card]}>
              <View style={styles.trioIcon}>
                <Icon name="trophy" size={22} color={colors.accent} filled />
              </View>
              <Text style={[styles.trioValue, { color: colors.text }]}>
                {progress.badges.length}/{BADGES.length}
              </Text>
              <Text style={[styles.trioLabel, { color: colors.textSecondary }]}>Trophies</Text>
            </View>
          </View>

          {/* Closest trophies: what to do next. */}
          {chase.length > 0 ? (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Almost there</Text>
              <View style={[styles.list, card]}>
                {chase.map(({ badge, value }, i) => (
                  <View
                    key={badge.id}
                    style={[styles.row, i > 0 && { borderTopWidth: 1, borderTopColor: separatorColor(colors) }]}>
                    <View style={[styles.rowTile, { backgroundColor: colors.accentSoft }]}>
                      <Icon name={badge.icon} size={22} color={colors.accent} filled />
                    </View>
                    <View style={styles.flex}>
                      <View style={styles.rowHead}>
                        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                          {badge.title}
                        </Text>
                        <Text style={[styles.rowCount, { color: colors.textSecondary }]}>
                          {value.toLocaleString()}/{badge.goal.toLocaleString()}
                        </Text>
                      </View>
                      <Text style={[styles.rowHint, { color: colors.textSecondary }]} numberOfLines={1}>
                        {badge.hint}
                      </Text>
                      <View style={[styles.track, { backgroundColor: trackColor(colors) }]}>
                        <View
                          style={[
                            styles.fill,
                            {
                              width: `${Math.round((badge.goal > 0 ? value / badge.goal : 0) * 100)}%`,
                              backgroundColor: colors.accent,
                            },
                          ]}
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Everything you two have done. */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Your numbers</Text>
            <View style={styles.grid}>
              {STATS.map((s) => (
                <View key={s.key} style={[styles.stat, card]}>
                  <Icon name={s.icon} size={18} color={colors.accent} />
                  <Text style={[styles.statValue, { color: colors.text }]}>
                    {(progress.stats[s.key] ?? 0).toLocaleString()}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={2}>
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Every title on the road: reached, where you are, and what's ahead. */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>The road</Text>
            <View style={[styles.list, card]}>
              {TITLE_TIERS.map((title, i) => {
                const startLevel = i * LEVELS_PER_TIER + 1;
                const reached = i < currentTier;
                const here = i === currentTier;
                const earned = reached || here;
                const levels = `Levels ${startLevel}–${startLevel + LEVELS_PER_TIER - 1}`;
                return (
                  // A title you've reached (or are on) opens as an achievement to share.
                  <Pressable
                    key={title}
                    disabled={!earned}
                    onPress={() => setSharing({ title, line: here ? `Couple level ${info.level}` : levels })}
                    accessibilityRole={earned ? 'button' : undefined}
                    accessibilityLabel={earned ? `${title}, share` : `${title}, locked`}
                    style={({ pressed }) => [
                      styles.tier,
                      i > 0 && { borderTopWidth: 1, borderTopColor: separatorColor(colors) },
                      here && { backgroundColor: colors.accentSoft },
                      pressed && styles.pressed,
                    ]}>
                    <View
                      style={[
                        styles.tierDot,
                        reached || here
                          ? { backgroundColor: colors.accent }
                          : { borderWidth: 2, borderColor: outlineColor(colors) },
                      ]}>
                      {reached ? <Icon name="check" size={13} color={colors.onAccent} /> : null}
                      {here ? <Icon name="star" size={12} color={colors.onAccent} filled /> : null}
                    </View>
                    <View style={styles.flex}>
                      <Text
                        style={[
                          styles.tierTitle,
                          { color: reached || here ? colors.text : colors.textTertiary },
                        ]}>
                        {title}
                      </Text>
                      <Text style={[styles.tierSub, { color: colors.textSecondary }]}>
                        {here
                          ? `You're here · level ${info.level}`
                          : reached
                            ? levels
                            : `From level ${startLevel} · ${xpForLevel(startLevel).toLocaleString()} XP`}
                      </Text>
                    </View>
                    {earned ? (
                      <Icon name="share" size={17} color={colors.textSecondary} />
                    ) : (
                      <Icon name="lock" size={16} color={colors.textTertiary} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>

      {/* A title from The road, shared like an achievement. */}
      <ShareCardModal visible={!!sharing} onClose={() => setSharing(null)} title="Share your couple title">
        {sharing ? <TitleShareCard title={sharing.title} line={sharing.line} /> : null}
      </ShareCardModal>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  // One box for each headline icon (star, flame, trophy), so all three read the same size.
  trioIcon: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  idleFlame: { opacity: 0.4 },
  root: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  body: { paddingHorizontal: Spacing.lg, gap: 22, paddingTop: 6 },
  hero: { borderRadius: 28, padding: 20, alignItems: 'center', gap: 6, overflow: 'hidden' },
  heroAvatars: { position: 'absolute', top: 16, right: 16, flexDirection: 'row' },
  overlap: { marginLeft: -10 },
  heroEyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, marginTop: 8 },
  heroTitle: { fontSize: 26, fontWeight: '900', letterSpacing: -0.6 },
  heroTrack: { alignSelf: 'stretch', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 8 },
  heroFill: { height: '100%', borderRadius: 5 },
  heroXp: { fontSize: 13, fontWeight: '700', textAlign: 'center' },
  trio: { flexDirection: 'row', gap: 10 },
  trioCell: { flex: 1, borderRadius: 20, borderWidth: 1.5, padding: 12, gap: 4, alignItems: 'center' },
  trioValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  trioLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  section: { gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  list: { borderRadius: 22, borderWidth: 1.5, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  rowTile: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  rowHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  rowTitle: { flex: 1, fontSize: 15, fontWeight: '900' },
  rowCount: { fontSize: 12, fontWeight: '800' },
  rowHint: { fontSize: 12, marginTop: 1 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8 },
  fill: { height: '100%', borderRadius: 3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { width: '31.5%', flexGrow: 1, borderRadius: 18, borderWidth: 1.5, padding: 12, gap: 4 },
  statValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: '700' },
  tier: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  tierDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  tierTitle: { fontSize: 15, fontWeight: '800' },
  tierSub: { fontSize: 12, marginTop: 1 },
});
