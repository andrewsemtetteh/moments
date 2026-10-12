import { useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CelebrationHost, Confetti } from '@/components/games/Celebration';
import { RoundView } from '@/components/games/LiveRoomModal';
import { ChunkyButton, RoomDispatchProvider, ScoreHeader, firstName, useGameTone } from '@/components/games/room-ui';
import { PlayHeader } from '@/components/play/PlayHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useGameSession } from '@/hooks/play-queries';
import { useTheme } from '@/hooks/useTheme';
import { applySessionAction, endSession, isWaitingOn, nudgePartner, type GameSession } from '@/lib/game-room/sessions';
import { getGameDefinition, type RoomAction, type RoomPlayer, type RoomState } from '@/lib/game-room/types';
import { notifyIsland } from '@/lib/in-app-notify';
import { useAuthStore, useRelationshipStore } from '@/stores';

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
    Alert.alert('End this game?', 'It finishes for both of you, with the scores as they are.', [
      { text: 'Keep playing', style: 'cancel' },
      {
        text: 'End game',
        style: 'destructive',
        onPress: () =>
          void endSession(id, me, them)
            .then((saved) => queryClient.setQueryData(['gameSession', id], saved))
            .catch(() => undefined),
      },
    ]);
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
  const subtitle =
    state.phase === 'finished'
      ? 'Finished'
      : isWaitingOn(state, me.id)
        ? `Own time · round ${round} of ${state.totalRounds} · your move`
        : `Own time · round ${round} of ${state.totalRounds} · ${firstName(them.name)}’s move`;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 12 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        {state.phase === 'finished' ? (
          <Results
            session={session}
            onAgain={() => router.replace({ pathname: '/play/game/[kind]', params: { kind: state.game } })}
            onDone={() => router.back()}
          />
        ) : (
          <RoomDispatchProvider value={dispatch}>
            <Playing session={session} me={me} them={them} />
          </RoomDispatchProvider>
        )}
      </ScrollView>
      <CelebrationHost surface="room" />
    </KeyboardAvoidingView>
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

  const nudge = () => {
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
    <View style={[styles.nudge, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <Icon name="time" size={20} color={colors.textSecondary} />
      <Text style={[styles.nudgeText, { color: colors.textSecondary }]} numberOfLines={2}>
        Waiting on {name}
      </Text>
      <Pressable
        onPress={nudge}
        accessibilityRole="button"
        accessibilityLabel={`Nudge ${name}`}
        style={({ pressed }) => [styles.nudgeButton, { backgroundColor: accent, opacity: pressed ? 0.85 : 1 }]}>
        <Icon name="send" size={15} color="#FFFFFF" />
        <Text style={styles.nudgeButtonText}>Nudge</Text>
      </Pressable>
    </View>
  );
}

function Results({ session, onAgain, onDone }: { session: GameSession; onAgain: () => void; onDone: () => void }) {
  const { colors } = useTheme();
  const state = session.state;
  const tone = useGameTone(state.game);
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const result = state.result;
  const rows = [
    { id: user?.id ?? '', name: 'You', avatar: user?.avatar_url ?? null, label: user?.name },
    {
      id: partner?.id ?? '',
      name: firstName(partner?.name),
      avatar: partner?.avatar_url ?? null,
      label: partner?.name,
    },
  ]
    .map((r) => ({ ...r, score: state.scores[r.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <View style={styles.results}>
      <Confetti burstKey={state.v} />
      <Text style={[styles.headline, { color: colors.text }]}>{result?.headline ?? 'Game over'}</Text>
      {result ? (
        <View style={[styles.xp, { backgroundColor: tone.soft, borderColor: tone.accent }]}>
          <Text style={[styles.xpText, { color: tone.accent }]}>+{result.xp} XP for your couple</Text>
        </View>
      ) : null}
      <View style={[styles.board, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        {rows.map((row) => (
          <View key={row.id} style={styles.boardRow}>
            <Avatar name={row.label} imageUrl={row.avatar} size={36} />
            <Text style={[styles.boardName, { color: colors.text }]}>{row.name}</Text>
            <Text style={[styles.boardScore, { color: colors.text }]}>{row.score}</Text>
          </View>
        ))}
      </View>
      {result?.highlights.map((h) => (
        <Text key={h} style={[styles.highlight, { color: colors.textSecondary }]}>
          {h}
        </Text>
      ))}
      <View style={styles.actions}>
        <ChunkyButton label="Play again" color={tone.accent} onPress={onAgain} />
        <ChunkyButton label="Done" compact color={colors.textTertiary} onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  endText: { fontSize: 15, fontWeight: '700' },
  body: { padding: 16, flexGrow: 1 },
  playing: { gap: 22 },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 12,
  },
  nudgeText: { flex: 1, fontSize: 15, fontWeight: '700' },
  nudgeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 38,
  },
  nudgeButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  results: { alignItems: 'center', gap: 14, paddingTop: 16 },
  headline: { fontSize: 26, fontWeight: '900', textAlign: 'center' },
  xp: { borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 8 },
  xpText: { fontSize: 14, fontWeight: '900' },
  board: { alignSelf: 'stretch', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boardName: { flex: 1, fontSize: 16, fontWeight: '800' },
  boardScore: { fontSize: 22, fontWeight: '900' },
  highlight: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: 12, marginTop: 8 },
});
