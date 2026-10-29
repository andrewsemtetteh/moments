import * as Haptics from '@/lib/haptics';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { firstName } from '@/components/games/room-ui';
import { Spacing } from '@/constants/design-system';
import { useActiveGameSessions } from '@/hooks/play-queries';
import { useIsPlus } from '@/hooks/useIsPlus';
import { useTheme } from '@/hooks/useTheme';
import { requirePlusNow } from '@/lib/plus';
import { isWaitingOn } from '@/lib/game-room/sessions';
import { LIVE_GAMES, getGameDefinition, type GameDefinition, type LiveGameKind } from '@/lib/game-room/types';
import { useAuthStore, useRelationshipStore } from '@/stores';

import { GAME_ART } from './game-art';
import { useRailCardWidth } from './HandpickedRail';
import { illustrationPalette } from './illustration-palette';
import { PlayCard } from './PlayCard';

function GameCard({ game, width, live }: { game: GameDefinition; width?: number; live?: boolean }) {
  const router = useRouter();
  // Endless games are written by AI: Plus (or its free trial) unlocks them.
  const locked = !useIsPlus();
  return (
    <PlayCard
      width={width}
      tone={PLAY_TONES[game.tone]}
      scene={GAME_ART[game.kind]}
      badge={game.team ? 'Team' : 'Versus'}
      title={game.title}
      sub={game.tagline}
      cta="Play"
      locked={locked}
      // The game's page (from Go live, set to a live session); while locked, the Plus page.
      onPress={() => {
        if (!requirePlusNow(game.title)) return;
        router.push({
          pathname: '/play/game/[kind]',
          params: live ? { kind: game.kind, mode: 'live' } : { kind: game.kind },
        });
      }}
    />
  );
}

/** Endless games grouped by how you play them. `live`: each opens its page set to a live session. */
export function GameGroups({ live }: { live?: boolean } = {}) {
  const { colors } = useTheme();
  return (
    <View style={styles.groups}>
      <Text style={[styles.groupLabel, { color: colors.text }]}>Team up</Text>
      {LIVE_GAMES.filter((g) => g.team).map((g) => (
        <GameCard key={g.kind} game={g} live={live} />
      ))}
      <Text style={[styles.groupLabel, { color: colors.text }]}>Go head to head</Text>
      {LIVE_GAMES.filter((g) => !g.team).map((g) => (
        <GameCard key={g.kind} game={g} live={live} />
      ))}
    </View>
  );
}

/** Horizontal rail of every game (All tab preview). */
export function GameRail() {
  const cardWidth = useRailCardWidth();
  return (
    <ScrollView
      horizontal
      alwaysBounceHorizontal={false}
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={cardWidth + 12}
      style={styles.bleed}
      contentContainerStyle={styles.rail}>
      {LIVE_GAMES.map((g) => (
        <GameCard key={g.kind} game={g} width={cardWidth} />
      ))}
    </ScrollView>
  );
}

/** Own-time games still running, with whose move it is. */
export function OwnTimeGames() {
  const router = useRouter();
  const { colors } = useTheme();
  const meId = useAuthStore((s) => s.user?.id ?? '');
  const partner = useRelationshipStore((s) => s.partner);
  const { data: sessions } = useActiveGameSessions();
  if (!sessions?.length) return null;

  return (
    <View style={styles.groups}>
      <Text style={[styles.groupLabel, { color: colors.text }]}>On your own time</Text>
      {sessions.map((s) => {
        const def = getGameDefinition(s.game_type);
        const myMove = isWaitingOn(s.state, meId);
        const round = Math.min(s.state.round + 1, s.state.totalRounds);
        return (
          <OwnTimeRow
            key={s.id}
            kind={def.kind}
            title={def.title}
            round={`Round ${round} of ${s.state.totalRounds}`}
            myMove={myMove}
            them={firstName(partner?.name)}
            onPress={() => router.push({ pathname: '/play/session/[id]', params: { id: s.id } })}
          />
        );
      })}
    </View>
  );
}

/**
 * A game in progress, as a quick row: the game's drawing, its name and round, and whose move it is
 * (filled when it's yours). Lighter than a card, so games under way don't crowd out the games list.
 */
function OwnTimeRow({
  kind,
  title,
  round,
  myMove,
  them,
  onPress,
}: {
  kind: LiveGameKind;
  title: string;
  round: string;
  myMove: boolean;
  them: string;
  onPress: () => void;
}) {
  const tone = PLAY_TONES[getGameDefinition(kind).tone];
  const c = useMemo(() => illustrationPalette(tone), [tone]);
  const xml = useMemo(() => GAME_ART[kind](c), [kind, c]);
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${round}, ${myMove ? 'your move' : `${them}’s move`}`}
      style={({ pressed }) => [styles.row, { backgroundColor: c.bg }, pressed && styles.rowPressed]}>
      <View style={styles.thumb}>
        <SvgXml xml={xml} width="100%" height="100%" />
      </View>
      <View style={styles.rowText}>
        <View style={styles.rowWords}>
          <Text style={[styles.rowTitle, { color: c.d }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          <Text style={[styles.rowSub, { color: c.d }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {round}
          </Text>
        </View>
        <View style={[styles.turn, myMove ? { backgroundColor: c.d } : styles.turnTheirs]}>
          <Text style={[styles.turnText, { color: myMove ? '#FFFFFF' : c.d }]} numberOfLines={1}>
            {myMove ? 'Your move' : `${them}’s move`}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  groups: { gap: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    minHeight: 112,
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 14,
  },
  rowPressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
  thumb: {
    width: 116,
    height: 87,
    borderRadius: 18,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.55)',
  },
  rowText: { flex: 1, minWidth: 0, gap: 8 },
  rowWords: { gap: 2 },
  rowTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3, lineHeight: 22 },
  rowSub: { fontSize: 14, fontWeight: '600', opacity: 0.75 },
  turn: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, height: 30, justifyContent: 'center' },
  turnTheirs: { backgroundColor: 'rgba(255,255,255,0.7)' },
  turnText: { fontSize: 13, fontWeight: '900' },
  groupLabel: { fontSize: 23, fontWeight: '900', letterSpacing: -0.4, marginTop: 6 },
  bleed: { marginHorizontal: -Spacing.lg },
  rail: { gap: 12, paddingHorizontal: Spacing.lg, paddingBottom: 6 },
});
