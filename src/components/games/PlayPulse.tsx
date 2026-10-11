import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { useTheme } from '@/hooks/useTheme';
import { getGameDefinition } from '@/lib/game-room/types';
import { BADGES, activeStreak, emptyProgress, levelInfo, questView, todayKey } from '@/lib/play-progress';
import { openActivities } from '@/lib/router';
import { useAuthStore } from '@/stores';
import { useGameRoomStore } from '@/stores/game-room-store';
import { usePlayProgressStore } from '@/stores/play-progress-store';

function useProgress() {
  const progress = usePlayProgressStore((s) => s.progress);
  return progress ?? emptyProgress(todayKey());
}

/** Home teaser for the Play tab: a live-room invite when one is open, else level + today's quests. */
export function PlayPulseCard() {
  const { colors } = useTheme();
  const meId = useAuthStore((s) => s.user?.id);
  const room = useGameRoomStore((s) => s.state);
  const progress = useProgress();
  const info = useMemo(() => levelInfo(progress.xp), [progress.xp]);
  const quests = useMemo(() => questView(progress), [progress]);
  const done = quests.filter((q) => q.done).length;
  const next = quests.find((q) => !q.done);

  const joinable = !!room && room.phase !== 'finished' && room.hostId !== meId;
  const def = joinable && room ? getGameDefinition(room.game) : null;
  const accent = def ? PLAY_TONES[def.tone].accent : colors.accent;

  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        openActivities();
      }}
      accessibilityRole="button"
      accessibilityLabel={joinable ? 'Join live game' : 'Open Play'}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: joinable ? accent : colors.border,
          borderWidth: joinable ? 2 : colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
          opacity: pressed ? 0.92 : 1,
        },
      ]}>
      <View style={[styles.badge, { backgroundColor: joinable ? accent : colors.accentSoft }]}>
        <Text style={styles.badgeEmoji}>{def ? def.emoji : '🎮'}</Text>
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {joinable && def ? `Live now · ${def.title}` : `Level ${info.level} · ${info.title}`}
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
          {joinable
            ? 'Your partner is waiting — jump in with voice 🎧'
            : next
              ? `Quest: ${next.title} · ${done}/${quests.length} done`
              : `All quests done today 🎉 · ${activeStreak(progress)} day streak`}
        </Text>
        {!joinable ? (
          <View style={[styles.track, { backgroundColor: colors.border }]}>
            <View style={[styles.fill, { width: `${Math.round(info.progress * 100)}%`, backgroundColor: colors.accent }]} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.cta, { color: accent }]}>{joinable ? 'Join' : 'Play'}</Text>
    </Pressable>
  );
}

/** Profile summary of the couple's play history. */
export function CoupleLevelCard() {
  const { colors } = useTheme();
  const progress = useProgress();
  const info = useMemo(() => levelInfo(progress.xp), [progress.xp]);
  const stat = (key: string) => progress.stats[key] ?? 0;
  const tiles = [
    { label: 'Games', value: stat('games_played'), emoji: '🎮' },
    { label: 'Live rooms', value: stat('live_games'), emoji: '🎧' },
    { label: 'In sync', value: stat('sync_matches'), emoji: '🧠' },
    { label: 'Best streak', value: progress.bestStreak, emoji: '🔥' },
  ];

  return (
    <Pressable
      onPress={() => openActivities()}
      accessibilityRole="button"
      accessibilityLabel="Open Play"
      style={[
        styles.levelCard,
        { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth },
      ]}>
      <View style={styles.levelTop}>
        <View style={[styles.levelBubble, { backgroundColor: colors.accent }]}>
          <Text style={[styles.levelNum, { color: colors.onAccent }]}>{info.level}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>{info.title}</Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {progress.xp.toLocaleString()} XP · {progress.badges.length}/{BADGES.length} badges
          </Text>
        </View>
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={[styles.fill, { width: `${Math.round(info.progress * 100)}%`, backgroundColor: colors.accent }]} />
      </View>
      <View style={styles.tiles}>
        {tiles.map((t) => (
          <View key={t.label} style={[styles.tile, { backgroundColor: colors.surfaceElevated }]}>
            <Text style={styles.tileEmoji}>{t.emoji}</Text>
            <Text style={[styles.tileValue, { color: colors.text }]}>{t.value}</Text>
            <Text style={[styles.tileLabel, { color: colors.textTertiary }]}>{t.label}</Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 22, padding: 14 },
  badge: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badgeEmoji: { fontSize: 24 },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: '800' },
  sub: { fontSize: 12, fontWeight: '600' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 2 },
  fill: { height: 6, borderRadius: 3 },
  cta: { fontSize: 14, fontWeight: '900' },
  levelCard: { borderRadius: 22, padding: 16, gap: 12 },
  levelTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  levelBubble: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  levelNum: { fontSize: 20, fontWeight: '900' },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: { flex: 1, borderRadius: 14, paddingVertical: 10, alignItems: 'center', gap: 2 },
  tileEmoji: { fontSize: 16 },
  tileValue: { fontSize: 18, fontWeight: '900' },
  tileLabel: { fontSize: 10, fontWeight: '700' },
});
