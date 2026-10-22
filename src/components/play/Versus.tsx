import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { firstName } from '@/components/games/room-ui';
import { Icon } from '@/components/ui/Icon';
import { Crown, CROWN_GOLD } from '@/components/ui/Crown';
import { Avatar, separatorColor } from '@/components/ui/primitives';
import type { StyleProp, ViewStyle } from 'react-native';
import { useDailyDuel } from '@/hooks/play-queries';
import { useTheme } from '@/hooks/useTheme';
import { leadLine, readRivalry, seasonName, bestSync, type Rivalry } from '@/lib/game-room/rivalry';
import { LIVE_GAMES, type LiveGameKind } from '@/lib/game-room/types';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { usePlayProgressStore } from '@/stores/play-progress-store';

import { PlayType, playCardStyle } from './PlayKit';

/** Your head-to-head record, this season and last season's champion. */
export function useRivalry(): Rivalry & { meId: string; themName: string; themId: string } {
  const progress = usePlayProgressStore((s) => s.progress);
  const meId = useAuthStore((s) => s.user?.id ?? '');
  const partner = useRelationshipStore((s) => s.partner);
  const themId = partner?.id ?? '';
  return { ...readRivalry(progress, meId, themId), meId, themId, themName: firstName(partner?.name) };
}

/** Best sync score in a team game, or null before you've played it. */
export function useBestSync(game: LiveGameKind): number | null {
  const progress = usePlayProgressStore((s) => s.progress);
  return bestSync(progress, game);
}

/**
 * The scoreboard between you two: all time, this month's season, and who took last month.
 * `compact` is the one-line version for results screens and game setup.
 */
export function RivalryCard({
  compact,
  onPress,
  shareable = false,
}: {
  compact?: boolean;
  onPress?: () => void;
  /** Tapping shares it (a share icon instead of the arrow). */
  shareable?: boolean;
}) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const r = useRivalry();
  const season = seasonName(r.season.key);

  if (compact) {
    return (
      <View style={[styles.compact, playCardStyle(colors)]}>
        <Icon name="swords" size={18} color={colors.accent} />
        <Text style={[PlayType.body, styles.flex, { color: colors.text }]}>
          <Text style={styles.bold}>{leadLine(r.allTime, r.themName)}</Text> all time · {season}: {r.season.me}–
          {r.season.them}
        </Text>
      </View>
    );
  }

  const champ = r.lastSeason?.championId;
  const content = (
    <>
      <View style={styles.head}>
        <View style={styles.headEyebrow}>
          <Icon name="swords" size={15} color={colors.accent} />
          <Text style={[PlayType.eyebrow, { color: colors.accent }]}>HEAD TO HEAD</Text>
        </View>
        {onPress ? (
          <Icon name={shareable ? 'share' : 'chevronRight'} size={16} color={shareable ? colors.accent : colors.textTertiary} />
        ) : null}
      </View>
      <View style={styles.versus}>
        <Side
          name="You"
          avatar={user?.avatar_url}
          label={user?.name}
          wins={r.allTime.me}
          lead={r.allTime.me > r.allTime.them}
        />
        <View style={styles.middle}>
          <Text style={[styles.vs, { color: colors.textTertiary }]}>VS</Text>
          {r.allTime.ties ? (
            <Text style={[styles.ties, { color: colors.textTertiary }]}>
              {r.allTime.ties} {r.allTime.ties === 1 ? 'tie' : 'ties'}
            </Text>
          ) : null}
        </View>
        <Side
          name={r.themName}
          avatar={partner?.avatar_url}
          label={partner?.name}
          wins={r.allTime.them}
          lead={r.allTime.them > r.allTime.me}
        />
      </View>
      <View style={[styles.season, { borderTopColor: colors.border }]}>
        <Text style={[PlayType.title, { color: colors.text }]}>{season} season</Text>
        <Text style={[PlayType.body, { color: colors.textSecondary }]}>{leadLine(r.season, r.themName)}</Text>
      </View>
      {r.lastSeason ? (
        <Text style={[PlayType.body, { color: colors.textSecondary }]}>
          👑 {seasonName(r.lastSeason.key)} champion: {champ === r.meId ? 'you' : champ ? r.themName : 'a tie'} (
          {r.lastSeason.me}–{r.lastSeason.them})
        </Text>
      ) : null}
    </>
  );

  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.card, playCardStyle(colors), pressed && styles.pressed]}>
      {content}
    </Pressable>
  ) : (
    <View style={[styles.card, playCardStyle(colors)]}>{content}</View>
  );
}

function Side({
  name,
  label,
  avatar,
  wins,
  lead,
}: {
  name: string;
  label?: string | null;
  avatar?: string | null;
  wins: number;
  lead: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.side}>
      {/* Whoever's ahead wears the crown, sitting on their photo, with a gold ring round it. */}
      <View style={[styles.ring, { borderColor: lead ? CROWN_GOLD : 'transparent' }]}>
        <Avatar name={label ?? name} imageUrl={avatar ?? undefined} size={AVATAR} />
        {lead ? (
          <View style={styles.crown} pointerEvents="none">
            <Crown size={CROWN} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.wins, { color: colors.text }]}>{wins}</Text>
      <Text style={[PlayType.body, { color: colors.textSecondary }]} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

/** "Your best: 80% in sync" for a team game, or a nudge to set one. */
export function SyncBestLine({ game, current }: { game: LiveGameKind; current?: number }) {
  const { colors } = useTheme();
  const best = useBestSync(game);
  const newBest = current !== undefined && current > 0 && current >= (best ?? 0);
  return (
    <View style={[styles.compact, playCardStyle(colors)]}>
      <Text style={styles.emoji}>{newBest ? '🎉' : '🧠'}</Text>
      <Text style={[PlayType.body, styles.flex, { color: colors.text }]}>
        {newBest ? (
          <Text style={styles.bold}>Your best sync yet: {current}%</Text>
        ) : best !== null ? (
          <>
            Your best: <Text style={styles.bold}>{best}% in sync</Text>
          </>
        ) : (
          'Match your answers to set your first sync score.'
        )}
      </Text>
    </View>
  );
}

/** Past seasons and who took each one, newest first. */
export function SeasonHistory({ limit = 6, style }: { limit?: number; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const r = useRivalry();
  if (r.champions.length === 0) return null;
  return (
    <View style={[styles.list, playCardStyle(colors), style]}>
      {r.champions.slice(0, limit).map((c, i) => (
        <View
          key={c.key}
          style={[
            styles.listRow,
            i > 0 && { borderTopWidth: 1, borderTopColor: separatorColor(colors) },
          ]}>
          <Text style={[PlayType.title, styles.flex, { color: colors.text }]}>{seasonName(c.key)}</Text>
          <Text style={[PlayType.body, { color: colors.textSecondary }]}>
            {c.championId === r.meId ? '👑 You' : c.championId ? `👑 ${r.themName}` : '🤝 Tie'} · {c.me}–{c.them}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Your best sync score in each team game. */
export function SyncBests({ style }: { style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const progress = usePlayProgressStore((s) => s.progress);
  return (
    <View style={[styles.list, playCardStyle(colors), style]}>
      {LIVE_GAMES.filter((g) => g.team).map((g, i) => {
        const best = bestSync(progress, g.kind);
        return (
          <View
            key={g.kind}
            style={[
              styles.listRow,
              i > 0 && { borderTopWidth: 1, borderTopColor: separatorColor(colors) },
            ]}>
            <Text style={styles.emoji}>{g.emoji}</Text>
            <Text style={[PlayType.title, styles.flex, { color: colors.text }]}>{g.title}</Text>
            <Text style={[PlayType.title, { color: best !== null ? colors.accent : colors.textTertiary }]}>
              {best !== null ? `${best}%` : 'Not yet'}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Today's duel on the Play tab: what's waiting, or how it went. */
export function DailyDuelCard() {
  const router = useRouter();
  const { colors } = useTheme();
  const meId = useAuthStore((s) => s.user?.id ?? '');
  const partner = useRelationshipStore((s) => s.partner);
  const { today, yesterday, todayKey, yesterdayKey } = useDailyDuel();
  const tone = PLAY_TONES.amber;
  if (!partner) return null;
  const them = firstName(partner.name);

  // Yesterday's still open and waiting on you: that one first.
  const pending = yesterday && !yesterday.state.result && !yesterday.state.answers[meId] ? yesterday : null;
  const duel = pending ?? today;
  const date = pending ? yesterdayKey : todayKey;
  const state = duel?.state;
  const mine = !!state?.answers[meId];
  const theirs = !!state?.answers[partner.id];
  const result = state?.result;

  let title = 'Today’s duel';
  let line = 'Three quick questions. Beat your partner.';
  let cta = 'Play';
  if (pending) {
    title = 'Yesterday’s duel';
    line = `${them} played. Finish it before it closes tonight.`;
  } else if (result) {
    const won = result.winnerId === meId;
    const me = result.scores[meId] ?? 0;
    const they = result.scores[partner.id] ?? 0;
    line = won
      ? `You won ${me}–${they}. New questions tomorrow.`
      : result.winnerId
        ? `${them} won ${they}–${me}. Rematch tomorrow.`
        : `A tie at ${me}. New questions tomorrow.`;
    cta = 'See answers';
  } else if (mine) {
    line = `Locked in. Waiting for ${them}.`;
    cta = 'Open';
  } else if (theirs) {
    line = `${them} played. Your turn.`;
  }

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/play/duel', params: { date } })}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${line}`}
      style={({ pressed }) => [styles.duel, { backgroundColor: tone.accent }, pressed && styles.pressed]}>
      <View style={styles.duelGlow} pointerEvents="none" />
      <View style={styles.flex}>
        <View style={styles.duelEyebrowRow}>
          <Icon name="swords" size={15} color="#FFFFFF" />
          <Text style={styles.duelEyebrow}>{title.toUpperCase()}</Text>
        </View>
        <Text style={styles.duelLine}>{line}</Text>
      </View>
      <View style={[styles.duelCta, { backgroundColor: 'rgba(0,0,0,0.22)' }]}>
        <Text style={styles.duelCtaText}>{cta}</Text>
      </View>
      {!mine && !result ? <View style={[styles.dot, { backgroundColor: colors.error }]} /> : null}
    </Pressable>
  );
}

const AVATAR = 44;
const CROWN = 26;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: '900' },
  pressed: { opacity: 0.9 },
  emoji: { fontSize: 18 },
  compact: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  card: { padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  versus: { flexDirection: 'row', alignItems: 'center', paddingTop: 10 },
  side: { flex: 1, alignItems: 'center', gap: 2 },
  ring: { borderWidth: 2.5, borderRadius: 999, padding: 2 },
  // Centred on top of the photo, its lower part resting on the ring.
  crown: { position: 'absolute', top: -CROWN * 0.55, left: 0, right: 0, alignItems: 'center' },
  wins: { fontSize: 30, fontWeight: '900', letterSpacing: -0.6, marginTop: 4 },
  middle: { alignItems: 'center', gap: 2 },
  vs: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  ties: { fontSize: 11, fontWeight: '700' },
  season: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 2 },
  list: { overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  duel: { borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12, overflow: 'hidden' },
  duelGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.14)',
    right: -50,
    top: -70,
  },
  duelEyebrowRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  duelEyebrow: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', letterSpacing: 1 },
  duelLine: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', lineHeight: 22, marginTop: 4 },
  duelCta: { borderRadius: 999, paddingHorizontal: 14, height: 36, justifyContent: 'center' },
  duelCtaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  dot: { position: 'absolute', top: 12, right: 12, width: 9, height: 9, borderRadius: 5 },
});
