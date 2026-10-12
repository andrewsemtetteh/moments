import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import type { ActivityArtId } from '@/components/activities/explore/ActivityArt';
import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { firstName } from '@/components/games/room-ui';
import { Spacing } from '@/constants/design-system';
import { useActiveGameSessions } from '@/hooks/play-queries';
import { useTheme } from '@/hooks/useTheme';
import { isWaitingOn } from '@/lib/game-room/sessions';
import { LIVE_GAMES, getGameDefinition, type GameDefinition, type LiveGameKind } from '@/lib/game-room/types';
import { useAuthStore, useRelationshipStore } from '@/stores';

import { useRailCardWidth } from './HandpickedRail';
import { PlayCard } from './PlayCard';

export const GAME_ART: Record<LiveGameKind, ActivityArtId> = {
  wouldYouRather: 'wouldYouRather',
  thisOrThat: 'thisOrThat',
  whosLikely: 'whosLikely',
  truthDare: 'truthDare',
  guessAnswer: 'guessAnswer',
  twoTruths: 'emojiStory',
  quiz: 'quizLive',
};

function GameCard({ game, width }: { game: GameDefinition; width?: number }) {
  const router = useRouter();
  return (
    <PlayCard
      width={width}
      tone={PLAY_TONES[game.tone]}
      art={GAME_ART[game.kind]}
      badge={game.team ? 'Team' : 'Versus'}
      title={game.title}
      sub={game.tagline}
      cta="Play"
      onPress={() => router.push({ pathname: '/play/game/[kind]', params: { kind: game.kind } })}
    />
  );
}

/** Endless games grouped by how you play them. */
export function GameGroups() {
  const { colors } = useTheme();
  return (
    <View style={styles.groups}>
      <Text style={[styles.groupLabel, { color: colors.text }]}>Team up</Text>
      {LIVE_GAMES.filter((g) => g.team).map((g) => (
        <GameCard key={g.kind} game={g} />
      ))}
      <Text style={[styles.groupLabel, { color: colors.text }]}>Go head to head</Text>
      {LIVE_GAMES.filter((g) => !g.team).map((g) => (
        <GameCard key={g.kind} game={g} />
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
          <PlayCard
            key={s.id}
            tone={PLAY_TONES[def.tone]}
            art={GAME_ART[def.kind]}
            badge={myMove ? 'Your move' : `${firstName(partner?.name)}’s move`}
            title={def.title}
            sub={`Round ${round} of ${s.state.totalRounds}`}
            cta={myMove ? 'Play' : 'Open'}
            onPress={() => router.push({ pathname: '/play/session/[id]', params: { id: s.id } })}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: 12 },
  groupLabel: { fontSize: 23, fontWeight: '900', letterSpacing: -0.4, marginTop: 6 },
  bleed: { marginHorizontal: -Spacing.lg },
  rail: { gap: 12, paddingHorizontal: Spacing.lg, paddingBottom: 6 },
});
