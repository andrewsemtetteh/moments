import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { DraggableSheet, SheetScrollView } from '@/components/ui/DraggableSheet';
import { Icon } from '@/components/ui/Icon';
import { Avatar, colorWithAlpha } from '@/components/ui/primitives';
import { StreakFlame } from '@/components/home/StreakFlame';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { BADGES, activeStreak, emptyProgress, levelInfo, questView, todayKey } from '@/lib/play-progress';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { usePlayProgressStore } from '@/stores/play-progress-store';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function useProgress() {
  const progress = usePlayProgressStore((s) => s.progress);
  return progress ?? emptyProgress(todayKey());
}

/* -------------------------------------------------------------------------- */
/* Hero: level ring, XP, streak                                               */
/* -------------------------------------------------------------------------- */

const RING = 84;
const STROKE = 9;
const RADIUS = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * RADIUS;

function LevelRing({ level, progress }: { level: number; progress: number }) {
  const { colors } = useTheme();
  const value = useSharedValue(0);
  useEffect(() => {
    value.value = withTiming(progress, { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [progress, value]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: CIRC * (1 - value.value) }));

  return (
    <View style={styles.ringWrap}>
      <Svg width={RING} height={RING} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={RING / 2}
          cy={RING / 2}
          r={RADIUS}
          stroke={colorWithAlpha(colors.onAccent, 0.25)}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={RING / 2}
          cy={RING / 2}
          r={RADIUS}
          stroke={colors.onAccent}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRC}
          animatedProps={animatedProps}
          fill="none"
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={[styles.ringLabel, { color: colorWithAlpha(colors.onAccent, 0.8) }]}>LVL</Text>
        <Text style={[styles.ringLevel, { color: colors.onAccent }]}>{level}</Text>
      </View>
    </View>
  );
}

export function PlayHero() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const progress = useProgress();
  const info = useMemo(() => levelInfo(progress.xp), [progress.xp]);
  const streak = activeStreak(progress);

  return (
    <LinearGradient
      colors={colors.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}>
      <View style={[styles.heroGlow, { backgroundColor: colorWithAlpha(colors.onAccent, 0.12) }]} pointerEvents="none" />
      <View style={styles.heroTop}>
        <LevelRing level={info.level} progress={info.progress} />
        <View style={styles.heroCopy}>
          <Text style={[styles.heroEyebrow, { color: colorWithAlpha(colors.onAccent, 0.8) }]}>YOUR COUPLE LEVEL</Text>
          <Text style={[styles.heroTitle, { color: colors.onAccent }]} numberOfLines={1}>
            {info.title}
          </Text>
          <Text style={[styles.heroXp, { color: colorWithAlpha(colors.onAccent, 0.88) }]}>
            {info.into} / {info.span} XP · {info.span - info.into} to {info.nextTitle}
          </Text>
        </View>
        <View style={styles.avatars}>
          <Avatar name={user?.name} imageUrl={user?.avatar_url} size={34} />
          <View style={styles.avatarOverlap}>
            <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={34} />
          </View>
        </View>
      </View>

      <View style={styles.heroChips}>
        <View style={[styles.heroChip, { backgroundColor: colorWithAlpha(colors.onAccent, 0.2) }]}>
          <StreakFlame size={15} tone={streak > 0 ? 'active' : 'idle'} />
          <Text style={[styles.heroChipText, { color: colors.onAccent }]}>
            {streak > 0 ? `${streak} day streak` : 'Start a streak'}
          </Text>
        </View>
        <View style={[styles.heroChip, { backgroundColor: colorWithAlpha(colors.onAccent, 0.2) }]}>
          <Text style={[styles.heroChipText, { color: colors.onAccent }]}>
            🏅 {progress.badges.length}/{BADGES.length} badges
          </Text>
        </View>
        <View style={[styles.heroChip, { backgroundColor: colorWithAlpha(colors.onAccent, 0.2) }]}>
          <Text style={[styles.heroChipText, { color: colors.onAccent }]}>⭐ {progress.xp.toLocaleString()} XP</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

/* -------------------------------------------------------------------------- */
/* Daily quests                                                               */
/* -------------------------------------------------------------------------- */

export function QuestsCard() {
  const { colors } = useTheme();
  const progress = useProgress();
  const quests = useMemo(() => questView(progress), [progress]);
  const done = quests.filter((q) => q.done).length;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Daily quests</Text>
          <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
            Finish them together for bonus XP · {done}/{quests.length} done
          </Text>
        </View>
      </View>
      <View style={[styles.questCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        {quests.map((quest, i) => {
          const pct = quest.target > 0 ? quest.count / quest.target : 0;
          return (
            <View
              key={quest.id}
              style={[styles.questRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border }]}>
              <View style={[styles.questIcon, { backgroundColor: quest.done ? colors.success : colors.accentSoft }]}>
                <Icon name={quest.done ? 'check' : quest.icon} size={20} color={quest.done ? '#FFFFFF' : colors.accent} />
              </View>
              <View style={{ flex: 1, gap: 6 }}>
                <Text
                  style={[
                    styles.questTitle,
                    { color: colors.text, textDecorationLine: quest.done ? 'line-through' : 'none', opacity: quest.done ? 0.6 : 1 },
                  ]}>
                  {quest.title}
                </Text>
                <View style={[styles.questTrack, { backgroundColor: colors.border }]}>
                  <View
                    style={[
                      styles.questFill,
                      { width: `${Math.round((quest.done ? 1 : pct) * 100)}%`, backgroundColor: quest.done ? colors.success : colors.accent },
                    ]}
                  />
                </View>
              </View>
              <View style={[styles.rewardChip, { backgroundColor: quest.done ? colors.success : colors.accentSoft }]}>
                <Text style={[styles.rewardText, { color: quest.done ? '#fff' : colors.accent }]}>
                  {quest.done ? 'Done' : `+${quest.reward} XP`}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                     */
/* -------------------------------------------------------------------------- */

export function BadgesShelf() {
  const { colors } = useTheme();
  const progress = useProgress();
  const [open, setOpen] = useState(false);
  const owned = new Set(progress.badges);
  // Unlocked first, then the next few to chase.
  const ordered = [...BADGES].sort((a, b) => Number(owned.has(b.id)) - Number(owned.has(a.id)));

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Trophy shelf</Text>
          <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
            {owned.size} of {BADGES.length} unlocked
          </Text>
        </View>
        <Pressable onPress={() => setOpen(true)} hitSlop={8} accessibilityRole="button">
          <Text style={[styles.seeAll, { color: colors.accent }]}>See all</Text>
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hBleed} contentContainerStyle={styles.tiles}>
        {ordered.map((badge) => {
          const has = owned.has(badge.id);
          return (
            <View
              key={badge.id}
              style={[
                styles.badge,
                { backgroundColor: colors.surfaceElevated, borderColor: has ? colors.accent : colors.border },
              ]}>
              {has ? (
                <Text style={styles.badgeEmoji}>{badge.emoji}</Text>
              ) : (
                <View style={styles.lockSlot}>
                  <Icon name="lock" size={28} color={colors.textTertiary} />
                </View>
              )}
              <Text style={[styles.badgeTitle, { color: has ? colors.text : colors.textTertiary }]} numberOfLines={1}>
                {badge.title}
              </Text>
              <Text style={[styles.badgeHint, { color: colors.textTertiary }]} numberOfLines={2}>
                {badge.hint}
              </Text>
            </View>
          );
        })}
      </ScrollView>

      <DraggableSheet visible={open} onClose={() => setOpen(false)} dragAnywhere>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Trophy room</Text>
        <SheetScrollView contentContainerStyle={styles.trophyGrid}>
            {ordered.map((badge) => {
              const has = owned.has(badge.id);
              return (
                <View key={badge.id} style={styles.trophyItem}>
                  <View
                    style={[
                      styles.trophyIcon,
                      { backgroundColor: has ? colors.accentSoft : colors.surface, borderColor: has ? colors.accent : colors.border },
                    ]}>
                    {has ? (
                      <Text style={styles.trophyEmoji}>{badge.emoji}</Text>
                    ) : (
                      <Icon name="lock" size={24} color={colors.textTertiary} />
                    )}
                  </View>
                  <Text style={[styles.trophyName, { color: has ? colors.text : colors.textTertiary }]} numberOfLines={1}>
                    {badge.title}
                  </Text>
                  <Text style={[styles.trophyHint, { color: colors.textTertiary }]} numberOfLines={2}>
                    {badge.hint}
                  </Text>
                </View>
              );
            })}
        </SheetScrollView>
      </DraggableSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: 28, padding: 18, gap: 16, overflow: 'hidden' },
  heroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: -70,
    right: -50,
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ringWrap: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringLabel: { fontSize: 9, fontWeight: '900', letterSpacing: 1.4 },
  ringLevel: { fontSize: 30, fontWeight: '900', lineHeight: 34 },
  heroCopy: { flex: 1, gap: 2 },
  heroEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  heroTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  heroXp: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarOverlap: { marginLeft: -12 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 5 },
  heroChipText: { fontSize: 12, fontWeight: '800' },

  section: { marginTop: 22, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  sectionSub: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  seeAll: { fontSize: 14, fontWeight: '800' },

  hBleed: { marginHorizontal: -Spacing.lg },
  tiles: { gap: 12, paddingHorizontal: Spacing.lg, paddingBottom: 6 },

  questCard: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  questRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  questIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  questTitle: { fontSize: 15, fontWeight: '800' },
  questTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  questFill: { height: 7, borderRadius: 4 },
  rewardChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  rewardText: { fontSize: 12, fontWeight: '900' },

  badge: { width: 136, borderRadius: 20, borderWidth: 1.5, padding: 12, gap: 4, alignItems: 'center' },
  badgeEmoji: { fontSize: 34 },
  lockSlot: { height: 41, alignItems: 'center', justifyContent: 'center' },
  badgeTitle: { fontSize: 13, fontWeight: '900' },
  badgeHint: { fontSize: 11, fontWeight: '600', textAlign: 'center' },
  sheetTitle: { fontSize: 22, fontWeight: '900', marginBottom: 12 },
  trophyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, paddingBottom: 16 },
  trophyItem: { width: '30%', alignItems: 'center', gap: 4 },
  trophyIcon: { width: 64, height: 64, borderRadius: 22, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  trophyEmoji: { fontSize: 30 },
  trophyName: { fontSize: 12, fontWeight: '900', textAlign: 'center' },
  trophyHint: { fontSize: 10, fontWeight: '600', textAlign: 'center' },
});
