import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardFormScrollView } from '@/components/layout/KeyboardFormScrollView';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CelebrationHost, Confetti } from '@/components/games/Celebration';
import { RoundView } from '@/components/games/LiveRoomModal';
import { ChunkyButton, RoomDispatchProvider, ScoreHeader, firstName, shade, useGameTone } from '@/components/games/room-ui';
import { PlayHeader } from '@/components/play/PlayHeader';
import { PLAY_GUTTER, playCardStyle } from '@/components/play/PlayKit';
import { RivalryCard, SyncBestLine } from '@/components/play/Versus';
import { EmptyState } from '@/components/ui/EmptyState';
import { NudgeButton } from '@/components/ui/NudgeButton';
import { Avatar } from '@/components/ui/primitives';
import { useGameSession } from '@/hooks/play-queries';
import { useTheme } from '@/hooks/useTheme';
import {
  applySessionAction,
  endSession,
  isWaitingOn,
  nudgePartner,
  startOwnTimeGame,
  type GameSession,
} from '@/lib/game-room/sessions';
import { LIVE_GAMES, getGameDefinition, type RoomAction, type RoomPlayer, type RoomState } from '@/lib/game-room/types';
import { requirePlusNow } from '@/lib/plus';
import { notifyIsland } from '@/lib/in-app-notify';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { askChoice } from '@/components/ui/ChoiceSheet';

/** An own-time game: the live room's round panels, with moves saved to the session instead of broadcast. */
export default function OwnTimeGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const { data: session, isLoading } = useGameSession(id);

  const me = { id: user?.id ?? '', name: user?.name ?? 'You' };
  const them = { id: partner?.id ?? '', name: partner?.name ?? 'Partner' };

  const dispatch = useCallback(
    (action: RoomAction) => {
      if (!id || !user || !partner) return;
      void applySessionAction(id, action, me, them)
        .then((saved) => {
          queryClient.setQueryData(['gameSession', id], saved);
          void queryClient.invalidateQueries({ queryKey: ['gameSessions', saved.relationship_id] });
        })
        .catch((e) => Alert.alert('Couldn’t save your move', e instanceof Error ? e.message : 'Try again.'));
    },
    // me/them are rebuilt each render from stable ids
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, user?.id, partner?.id, queryClient],
  );

  const confirmEnd = () => {
    if (!id) return;
    askChoice({
      title: 'End this game?',
      message: 'It finishes for both of you, with the scores as they are.',
      cancelLabel: 'Keep playing',
      actions: [
        {
          label: 'End game',
          destructive: true,
          onPress: () =>
            void endSession(id, me, them)
              .then((saved) => queryClient.setQueryData(['gameSession', id], saved))
              .catch(() => undefined),
        },
      ],
    });
  };

  if (isLoading || !session) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <PlayHeader title="Game" />
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <EmptyState
            fill
            icon="gamepad"
            title="Game not found"
            text="It may have been ended. Start a new one from Endless."
          />
        )}
      </View>
    );
  }

  const state = session.state;
  const def = getGameDefinition(state.game);
  const round = Math.min(state.round + 1, state.totalRounds);
  // Unlimited: just the round you're on.
  const roundText = state.endless ? `round ${state.round + 1}` : `round ${round} of ${state.totalRounds}`;
  const subtitle =
    state.phase === 'finished'
      ? 'Finished'
      : isWaitingOn(state, me.id)
        ? `Own time · ${roundText} · your move`
        : `Own time · ${roundText} · ${firstName(them.name)}’s move`;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <PlayHeader
        title={`${def.emoji} ${def.title}`}
        subtitle={subtitle}
        right={
          state.phase === 'playing' ? (
            <Pressable onPress={confirmEnd} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.endText, { color: colors.textSecondary }]}>End</Text>
            </Pressable>
          ) : null
        }
      />
      <KeyboardFormScrollView
        // The field you tap comes above the keyboard, and the page scrolls on to its last button.
        endGap={-insets.bottom}
        // No pull past the top (it showed an empty gap above the page).
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 12 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {state.phase === 'finished' ? (
          <Results session={session} onDone={() => router.back()} />
        ) : (
          <RoomDispatchProvider value={dispatch}>
            <Playing session={session} me={me} them={them} />
          </RoomDispatchProvider>
        )}
      </KeyboardFormScrollView>
      <CelebrationHost surface="room" />
    </View>
  );
}

function Playing({ session, me, them }: { session: GameSession; me: RoomPlayer; them: RoomPlayer }) {
  const state: RoomState = session.state;
  const tone = useGameTone(state.game);
  const theirMoveOnly = isWaitingOn(state, them.id) && !isWaitingOn(state, me.id);
  return (
    <View style={styles.playing}>
      <ScoreHeader state={state} accent={tone.accent} />
      <RoundView state={state} />
      {theirMoveOnly ? <NudgeCard session={session} me={me} them={them} accent={tone.accent} /> : null}
    </View>
  );
}

/** It's their move: a gentle ping, confirmed by the Dynamic Island. */
function NudgeCard({
  session,
  me,
  them,
  accent,
}: {
  session: GameSession;
  me: RoomPlayer;
  them: RoomPlayer;
  accent: string;
}) {
  const { colors } = useTheme();
  const partner = useRelationshipStore((s) => s.partner);
  const name = firstName(them.name);
  const [nudged, setNudged] = useState(false);

  const nudge = () => {
    setNudged(true);
    void nudgePartner(session, me, them).then((sent) =>
      notifyIsland(
        sent
          ? {
              title: 'Nudge sent',
              message: `${name} will see it’s their move`,
              icon: 'send',
              avatar: partner?.avatar_url ?? null,
              avatarName: partner?.name ?? them.name,
            }
          : { title: 'Already nudged', message: `Give ${name} a little time`, icon: 'time' },
      ),
    );
  };

  return (
    <View style={[styles.nudge, playCardStyle(colors)]}>
      <Avatar name={them.name} imageUrl={partner?.avatar_url ?? undefined} size={36} />
      <View style={styles.nudgeLines}>
        <Text style={[styles.nudgeTitle, { color: colors.text }]} numberOfLines={1}>
          Waiting on {name}
        </Text>
        <Text style={[styles.nudgeText, { color: colors.textSecondary }]} numberOfLines={2}>
          It’s their move. You’ll get a notification when they play.
        </Text>
      </View>
      <NudgeButton name={name} nudged={nudged} accent={accent} onPress={nudge} />
    </View>
  );
}

function Results({ session, onDone }: { session: GameSession; onDone: () => void }) {
  const router = useRouter();
  const { colors } = useTheme();
  const state = session.state;
  const tone = useGameTone(state.game);
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const [starting, setStarting] = useState(false);
  const result = state.result;
  const meId = user?.id ?? '';
  const them = firstName(partner?.name);
  const rows = [
    { id: meId, name: 'You', avatar: user?.avatar_url ?? null, label: user?.name },
    { id: partner?.id ?? '', name: them, avatar: partner?.avatar_url ?? null, label: partner?.name },
  ]
    .map((r) => ({ ...r, score: state.scores[r.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  // After a versus game the one who lost picks what's next (either of you after a tie or a team game).
  const winnerId = result?.winnerId ?? null;
  const myPick = result?.teamGame || !winnerId || winnerId !== meId;

  // The same game again, same settings, straight in.
  const rematch = async () => {
    if (!user || !partner || starting) return;
    if (!requirePlusNow('AI games')) return;
    setStarting(true);
    try {
      const next = await startOwnTimeGame({
        relationshipId: session.relationship_id,
        me: { id: user.id, name: user.name ?? 'You' },
        partner: { id: partner.id, name: partner.name ?? 'Partner' },
        game: state.game,
        vibe: state.vibe,
        rounds: state.totalRounds,
        topic: state.topic || undefined,
        doubleFinal: state.doubleFinal,
      });
      router.replace({ pathname: '/play/session/[id]', params: { id: next.id } });
    } catch (e) {
      Alert.alert('Couldn’t start the rematch', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setStarting(false);
    }
  };

  const pickNext = () =>
    askChoice({
      title: 'Your pick',
      message: result?.teamGame || !winnerId ? 'What do you want to play next?' : 'You lost, so you choose the next game.',
      actions: LIVE_GAMES.map((g) => ({
        label: `${g.emoji} ${g.title}`,
        onPress: () => router.replace({ pathname: '/play/game/[kind]', params: { kind: g.kind } }),
      })),
    });

  return (
    <View style={styles.results}>
      <Confetti burstKey={state.v} />
      <Text style={[styles.headline, { color: colors.text }]}>{result?.headline ?? 'Game over'}</Text>
      {result ? (
        <View style={[styles.xp, { backgroundColor: tone.soft, borderColor: tone.accent }]}>
          <Text style={[styles.xpText, { color: tone.accent }]}>+{result.xp} XP for your couple</Text>
        </View>
      ) : null}
      <View style={[styles.board, playCardStyle(colors)]}>
        {rows.map((row) => (
          <View key={row.id} style={styles.boardRow}>
            <Avatar name={row.label} imageUrl={row.avatar} size={36} />
            <Text style={[styles.boardName, { color: colors.text }]}>
              {row.name} {!result?.teamGame && winnerId === row.id ? '👑' : ''}
            </Text>
            <Text style={[styles.boardScore, { color: colors.text }]}>{row.score}</Text>
          </View>
        ))}
      </View>
      {result?.highlights.map((h) => (
        <Text key={h} style={[styles.highlight, { color: colors.textSecondary }]}>
          {h}
        </Text>
      ))}
      <View style={styles.record}>
        {result?.teamGame ? <SyncBestLine game={state.game} current={result.syncPct} /> : <RivalryCard compact />}
      </View>
      <View style={styles.actions}>
        <ChunkyButton label="Rematch" color={tone.accent} loading={starting} onPress={() => void rematch()} />
        {myPick ? (
          <ChunkyButton label="Pick the next game" compact color={shade(tone.accent, -0.15)} onPress={pickNext} />
        ) : (
          <Text style={[styles.highlight, { color: colors.textSecondary }]}>{them} picks the next game 😉</Text>
        )}
        <ChunkyButton label="Done" compact color={colors.textTertiary} onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  endText: { fontSize: 15, fontWeight: '700' },
  body: { padding: PLAY_GUTTER, flexGrow: 1 },
  playing: { gap: 22 },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingLeft: 12,
    paddingRight: 12,
  },
  nudgeLines: { flex: 1, gap: 2 },
  nudgeTitle: { fontSize: 15, fontWeight: '800' },
  nudgeText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  results: { alignItems: 'center', gap: 14, paddingTop: 16 },
  headline: { fontSize: 26, fontWeight: '900', textAlign: 'center' },
  xp: { borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 8 },
  xpText: { fontSize: 14, fontWeight: '900' },
  board: { alignSelf: 'stretch', padding: 14, gap: 12 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boardName: { flex: 1, fontSize: 16, fontWeight: '800' },
  boardScore: { fontSize: 22, fontWeight: '900' },
  highlight: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 12, marginTop: 8 },
  record: { alignSelf: 'stretch' },
});
