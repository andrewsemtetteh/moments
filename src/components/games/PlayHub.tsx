import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { shade } from '@/components/games/room-ui';
import { DraggableSheet } from '@/components/ui/DraggableSheet';
import { Avatar, colorWithAlpha } from '@/components/ui/primitives';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { gameRoom } from '@/lib/game-room/manager';
import { LIVE_GAMES, getGameDefinition, type LiveGameKind } from '@/lib/game-room/types';
import { BADGES, activeStreak, emptyProgress, levelInfo, questView, todayKey } from '@/lib/play-progress';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { useGameRoomStore } from '@/stores/game-room-store';
import { usePlayProgressStore } from '@/stores/play-progress-store';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function firstName(name?: string | null) {
  return (name ?? '').trim().split(/\s+/)[0] || 'Partner';
}

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
          <Text style={[styles.heroChipText, { color: colors.onAccent }]}>
            {streak > 0 ? `🔥 ${streak} day streak` : '🔥 Start a streak'}
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
/* Live rooms                                                                 */
/* -------------------------------------------------------------------------- */

function usePulse() {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.7, { duration: 800 }), withTiming(1, { duration: 800 })), -1);
  }, [pulse]);
  return useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: 2.2 - pulse.value }));
}

export function startLiveRoom(game?: LiveGameKind) {
  const { partner } = useRelationshipStore.getState();
  if (!partner) {
    Alert.alert('Connect with your partner', 'Live rooms are for two — link up with your partner first.');
    return;
  }
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  void gameRoom.openRoom(game);
}

export function LiveRoomSection() {
  const { colors } = useTheme();
  const meId = useAuthStore((s) => s.user?.id);
  const partner = useRelationshipStore((s) => s.partner);
  const room = useGameRoomStore((s) => s.state);
  const partnerOnline = useGameRoomStore((s) => s.partnerOnline);
  const partnerInRoom = useGameRoomStore((s) => s.partnerInRoom);
  const pulseStyle = usePulse();
  const partnerName = firstName(partner?.name);

  const joinable = !!room && room.phase !== 'finished' && room.hostId !== meId;
  const myRoom = !!room && room.phase !== 'finished' && room.hostId === meId;
  const roomTone = room ? PLAY_TONES[getGameDefinition(room.game).tone] : null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Live rooms</Text>
          <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
            Play together with voice — AI writes every round.
          </Text>
        </View>
        <View style={[styles.presencePill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <View style={[styles.presenceDot, { backgroundColor: partnerOnline ? colors.success : colors.textTertiary }]} />
          <Text style={[styles.presenceText, { color: colors.textSecondary }]}>
            {partnerInRoom ? `${partnerName} in room` : partnerOnline ? `${partnerName} online` : `${partnerName} away`}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={() => startLiveRoom()}
        accessibilityRole="button"
        accessibilityLabel={joinable ? 'Join live room' : myRoom ? 'Return to your live room' : 'Start a live room'}
        style={({ pressed }) => [pressed && { transform: [{ scale: 0.985 }] }]}>
        <LinearGradient
          colors={
            joinable && roomTone
              ? [roomTone.accent, shade(roomTone.accent, -0.3)]
              : ['#6C4DFF', '#B14DFF']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.liveCard}>
          <View style={styles.liveGlow} pointerEvents="none" />
          <View style={styles.liveBadge}>
            <View style={styles.liveDotWrap}>
              <Animated.View style={[styles.liveHalo, pulseStyle]} />
              <View style={styles.liveDot} />
            </View>
            <Text style={styles.liveBadgeText}>{joinable ? 'LIVE NOW' : 'LIVE ROOM'}</Text>
          </View>
          <Text style={styles.liveTitle}>
            {joinable
              ? `${partnerName} is waiting for you`
              : myRoom
                ? 'Your room is open'
                : 'Start a live game night'}
          </Text>
          <Text style={styles.liveSub}>
            {joinable && room
              ? `${getGameDefinition(room.game).emoji} ${getGameDefinition(room.game).title} · jump in with voice`
              : myRoom
                ? 'Tap to head back in'
                : 'Voice chat + Would You Rather, Truth or Dare, quizzes & more'}
          </Text>
          <View style={styles.liveCta}>
            <Text style={styles.liveCtaText}>{joinable ? 'Join room' : myRoom ? 'Return' : 'Open room'} 🎧</Text>
          </View>
        </LinearGradient>
      </Pressable>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.hBleed}
        contentContainerStyle={styles.tiles}>
        {LIVE_GAMES.map((game) => {
          const tone = PLAY_TONES[game.tone];
          return (
            <Pressable
              key={game.kind}
              onPress={() => startLiveRoom(game.kind)}
              accessibilityRole="button"
              accessibilityLabel={`Play ${game.title} live`}
              style={({ pressed }) => [
                styles.tile,
                {
                  backgroundColor: tone.accent,
                  borderBottomColor: shade(tone.accent, -0.3),
                  borderBottomWidth: pressed ? 2 : 6,
                  marginTop: pressed ? 4 : 0,
                },
              ]}>
              <View style={styles.tileLive}>
                <Text style={styles.tileLiveText}>🎧 LIVE</Text>
              </View>
              <Text style={styles.tileEmoji}>{game.emoji}</Text>
              <Text style={styles.tileTitle} numberOfLines={2}>
                {game.title}
              </Text>
              <Text style={styles.tileMeta}>{game.team ? 'Team · sync up' : 'Versus · win it'}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
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
                <Text style={styles.questEmoji}>{quest.done ? '✅' : quest.emoji}</Text>
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
              <Text style={[styles.badgeEmoji, { opacity: has ? 1 : 0.25 }]}>{has ? badge.emoji : '🔒'}</Text>
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

      <DraggableSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Trophy room</Text>
        <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
          <View style={styles.trophyGrid}>
            {ordered.map((badge) => {
              const has = owned.has(badge.id);
              return (
                <View key={badge.id} style={styles.trophyItem}>
                  <View
                    style={[
                      styles.trophyIcon,
                      { backgroundColor: has ? colors.accentSoft : colors.surface, borderColor: has ? colors.accent : colors.border },
                    ]}>
                    <Text style={[styles.trophyEmoji, { opacity: has ? 1 : 0.3 }]}>{has ? badge.emoji : '🔒'}</Text>
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
          </View>
        </ScrollView>
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
  heroTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.4 },
  heroXp: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarOverlap: { marginLeft: -12 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  heroChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  heroChipText: { fontSize: 12, fontWeight: '800' },

  section: { marginTop: 22, gap: 12 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionTitle: { fontSize: 21, fontWeight: '900', letterSpacing: -0.3 },
  sectionSub: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  seeAll: { fontSize: 14, fontWeight: '800' },
  presencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  presenceDot: { width: 7, height: 7, borderRadius: 4 },
  presenceText: { fontSize: 11, fontWeight: '800' },

  liveCard: { borderRadius: 28, padding: 20, gap: 8, overflow: 'hidden' },
  liveGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.13)',
    right: -70,
    top: -80,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  liveDotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveHalo: { position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A5F' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF5A5F' },
  liveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  liveTitle: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: -0.4, marginTop: 4 },
  liveSub: { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  liveCta: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  liveCtaText: { color: '#3B2BB0', fontSize: 15, fontWeight: '900' },

  hBleed: { marginHorizontal: -Spacing.lg },
  tiles: { gap: 12, paddingHorizontal: Spacing.lg, paddingBottom: 6 },
  tile: { width: 150, minHeight: 176, borderRadius: 24, padding: 14, gap: 6, justifyContent: 'flex-end' },
  tileLive: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  tileLiveText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  tileEmoji: { fontSize: 44, marginBottom: 4 },
  tileTitle: { color: '#fff', fontSize: 17, fontWeight: '900', lineHeight: 21 },
  tileMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800' },

  questCard: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  questRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  questIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  questEmoji: { fontSize: 20 },
  questTitle: { fontSize: 15, fontWeight: '800' },
  questTrack: { height: 7, borderRadius: 4, overflow: 'hidden' },
  questFill: { height: 7, borderRadius: 4 },
  rewardChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  rewardText: { fontSize: 12, fontWeight: '900' },

  badge: { width: 116, borderRadius: 20, borderWidth: 1.5, padding: 12, gap: 4, alignItems: 'center' },
  badgeEmoji: { fontSize: 34 },
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
