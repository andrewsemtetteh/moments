import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { gameRoom } from '@/lib/game-room/manager';
import {
  LIVE_GAMES,
  VIBES,
  getGameDefinition,
  type RoomState,
} from '@/lib/game-room/types';
import { useGameRoomStore } from '@/stores/game-room-store';

import { CelebrationHost, Confetti } from './Celebration';
import {
  ChoicePanel,
  GuessPanel,
  LikelyPanel,
  QuizPanel,
  TruthDarePanel,
  TwoTruthsPanel,
} from './room-panels';
import {
  AudioPill,
  ChunkyButton,
  FloatingReactions,
  ReactionBar,
  RoundEnter,
  ScoreHeader,
  firstName,
  shade,
  useGameTone,
  useRoomPlayers,
} from './room-ui';

/** Full-screen live game room: lobby → rounds → results, with voice chat and reactions. */
export function LiveRoomModal() {
  const open = useGameRoomStore((s) => s.open);
  const state = useGameRoomStore((s) => s.state);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { meId, partner } = useRoomPlayers();
  const partnerInRoom = useGameRoomStore((s) => s.partnerInRoom);
  const notice = useGameRoomStore((s) => s.notice);
  const tone = useGameTone(state?.game ?? 'wouldYouRather');

  const isHost = !!state && state.hostId === meId;
  const inGame = !!state && (state.phase === 'playing' || state.phase === 'loading');

  const leave = () => {
    if (isHost && inGame) {
      Alert.alert('End the game?', 'You’re hosting, so leaving closes the room for both of you.', [
        { text: 'Keep playing', style: 'cancel' },
        { text: 'End & leave', style: 'destructive', onPress: () => void gameRoom.leaveRoom() },
      ]);
      return;
    }
    void gameRoom.leaveRoom();
  };

  useEffect(() => {
    if (!open) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      leave();
      return true;
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, isHost, inGame]);

  if (!open) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={leave}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <LinearGradient
          pointerEvents="none"
          colors={[tone.accent + '55', 'transparent']}
          style={[StyleSheet.absoluteFill, { height: 260 }]}
        />

        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={leave}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Leave room"
            style={[styles.closeBtn, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Icon name="close" size={20} color={colors.text} />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {state ? `${getGameDefinition(state.game).emoji} ${getGameDefinition(state.game).title}` : 'Live Room'}
            </Text>
            <View style={styles.presenceRow}>
              <View style={[styles.presenceDot, { backgroundColor: partnerInRoom ? colors.success : colors.textTertiary }]} />
              <Text style={[styles.presenceText, { color: colors.textSecondary }]}>
                {partnerInRoom ? `${firstName(partner.name)} is here` : `Waiting for ${firstName(partner.name)}`}
              </Text>
            </View>
          </View>

          <AudioPill onToggleMute={() => gameRoom.setMuted(!useGameRoomStore.getState().muted)} />
        </View>

        {notice ? (
          <Animated.View entering={FadeIn} style={[styles.notice, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.noticeText, { color: colors.text }]}>{notice}</Text>
          </Animated.View>
        ) : null}

        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {!state ? (
              <View style={styles.centered}>
                <ActivityIndicator color={colors.accent} />
                <Text style={[styles.centerText, { color: colors.textSecondary }]}>Connecting to the room…</Text>
              </View>
            ) : state.phase === 'lobby' ? (
              <Lobby state={state} isHost={isHost} />
            ) : state.phase === 'loading' ? (
              <Loading state={state} />
            ) : state.phase === 'playing' ? (
              <View style={styles.playing}>
                <ScoreHeader state={state} accent={tone.accent} />
                <RoundView state={state} />
                {isHost ? (
                  <Pressable onPress={leave} style={styles.endLink} accessibilityRole="button">
                    <Text style={[styles.endLinkText, { color: colors.textTertiary }]}>End game</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Results state={state} isHost={isHost} onLeave={leave} />
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={[styles.reactionDock, { paddingBottom: insets.bottom + 10 }]}>
          <ReactionBar onReact={(emoji) => gameRoom.react(emoji)} />
        </View>

        <FloatingReactions />
        <CelebrationHost surface="room" />
      </View>
    </Modal>
  );
}

export function RoundView({ state }: { state: RoomState }) {
  const tone = useGameTone(state.game);
  switch (state.game) {
    case 'wouldYouRather':
    case 'thisOrThat':
      return <ChoicePanel state={state} tone={tone} />;
    case 'whosLikely':
      return <LikelyPanel state={state} tone={tone} />;
    case 'truthDare':
      return <TruthDarePanel state={state} tone={tone} />;
    case 'guessAnswer':
      return <GuessPanel state={state} tone={tone} />;
    case 'twoTruths':
      return <TwoTruthsPanel state={state} tone={tone} />;
    case 'quiz':
      return <QuizPanel state={state} tone={tone} />;
  }
}

function Loading({ state }: { state: RoomState }) {
  const { colors } = useTheme();
  const def = getGameDefinition(state.game);
  return (
    <View style={styles.centered}>
      <Animated.Text entering={ZoomIn.springify()} style={styles.loadingEmoji}>
        {def.emoji}
      </Animated.Text>
      <ActivityIndicator color={PLAY_TONES[def.tone].accent} />
      <Text style={[styles.centerTitle, { color: colors.text }]}>Setting up your rounds…</Text>
      <Text style={[styles.centerText, { color: colors.textSecondary }]}>
        Getting {def.title} ready with a {state.vibe} vibe for you two.
      </Text>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Lobby                                                                      */
/* -------------------------------------------------------------------------- */

function Lobby({ state, isHost }: { state: RoomState; isHost: boolean }) {
  const { colors } = useTheme();
  const { meId, partner } = useRoomPlayers();
  const partnerInRoom = useGameRoomStore((s) => s.partnerInRoom);
  const def = getGameDefinition(state.game);
  const tone = PLAY_TONES[def.tone];
  const hostName = firstName(state.players.find((p) => p.id === state.hostId)?.name);

  const configure = (patch: Partial<{ game: typeof state.game; vibe: typeof state.vibe; rounds: number; topic: string }>) => {
    const game = patch.game ?? state.game;
    gameRoom.dispatch({
      t: 'configure',
      game,
      vibe: patch.vibe ?? state.vibe,
      rounds: patch.rounds ?? (patch.game ? getGameDefinition(game).defaultRounds : state.totalRounds),
      topic: patch.topic ?? state.topic,
    });
  };

  return (
    <View style={styles.lobby}>
      {state.message ? (
        <Text style={[styles.centerText, { color: colors.error, textAlign: 'center' }]}>{state.message}</Text>
      ) : null}

      <RoundEnter>
        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>PICK A GAME TOGETHER</Text>
        <Text style={[styles.lobbyHint, { color: colors.textTertiary }]}>
          Tap to suggest. When you both pick the same one, it’s set.
        </Text>
      </RoundEnter>

      <View style={styles.gameList}>
        {LIVE_GAMES.map((game, i) => {
          const t = PLAY_TONES[game.tone];
          const selected = game.kind === state.game;
          const iWant = state.suggestions?.[meId] === game.kind;
          const theyWant = state.suggestions?.[partner.id] === game.kind;
          const vote = theyWant ? `${firstName(partner.name).toUpperCase()} WANTS` : iWant ? 'YOU WANT' : null;
          return (
            <RoundEnter key={game.kind} delay={i * 40}>
              <Pressable
                onPress={() => gameRoom.dispatch({ t: 'suggest', game: game.kind })}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${game.title}${vote ? `, ${vote.toLowerCase()}` : ''}`}
                style={({ pressed }) => [
                  styles.gameCard,
                  {
                    backgroundColor: selected ? t.accent : colors.surfaceElevated,
                    borderColor: selected ? shade(t.accent, -0.3) : theyWant || iWant ? t.accent : colors.border,
                    borderBottomWidth: pressed ? 2 : 5,
                  },
                ]}>
                <Text style={styles.gameEmoji}>{game.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.gameTitle, { color: selected ? '#fff' : colors.text }]}>{game.title}</Text>
                  <Text style={[styles.gameTagline, { color: selected ? 'rgba(255,255,255,0.85)' : colors.textSecondary }]}>
                    {game.tagline}
                  </Text>
                </View>
                <View style={[styles.modeChip, { backgroundColor: selected ? 'rgba(255,255,255,0.22)' : t.soft }]}>
                  <Text style={[styles.modeChipText, { color: selected ? '#fff' : t.accent }]}>
                    {vote ?? (game.team ? 'TEAM' : 'VERSUS')}
                  </Text>
                </View>
              </Pressable>
            </RoundEnter>
          );
        })}
      </View>

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>VIBE</Text>
      <View style={styles.chipRow}>
        {VIBES.map((v) => {
          const selected = v.id === state.vibe;
          return (
            <Pressable
              key={v.id}
              disabled={!isHost}
              onPress={() => configure({ vibe: v.id })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.vibeChip,
                {
                  backgroundColor: selected ? tone.accent : colors.surfaceElevated,
                  borderColor: selected ? shade(tone.accent, -0.3) : colors.border,
                },
              ]}>
              <Text style={styles.vibeEmoji}>{v.emoji}</Text>
              <Text style={[styles.vibeLabel, { color: selected ? '#fff' : colors.text }]}>{v.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {def.usesTopic ? (
        <>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>QUIZ TOPIC</Text>
          <TextInput
            editable={isHost}
            value={state.topic}
            onChangeText={(topic) => configure({ topic })}
            placeholder="Anything: 90s movies, us, space…"
            placeholderTextColor={colors.textTertiary}
            maxLength={60}
            style={[styles.topicInput, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
          />
        </>
      ) : null}

      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ROUNDS</Text>
      <View style={styles.chipRow}>
        {def.roundOptions.map((n) => {
          const selected = n === state.totalRounds;
          return (
            <Pressable
              key={n}
              disabled={!isHost}
              onPress={() => configure({ rounds: n })}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              style={[
                styles.roundChip,
                {
                  backgroundColor: selected ? tone.accent : colors.surfaceElevated,
                  borderColor: selected ? shade(tone.accent, -0.3) : colors.border,
                },
              ]}>
              <Text style={[styles.roundChipText, { color: selected ? '#fff' : colors.text }]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.startWrap}>
        {isHost ? (
          <>
            <ChunkyButton
              label={partnerInRoom ? 'Start game' : `Waiting for ${firstName(partner.name)}…`}
              color={tone.accent}
              disabled={!partnerInRoom}
              onPress={() => gameRoom.dispatch({ t: 'begin' })}
            />
            {!partnerInRoom ? (
              <Text style={[styles.centerText, { color: colors.textTertiary, textAlign: 'center' }]}>
                We’ve pinged {firstName(partner.name)}. The game starts as soon as they join.
              </Text>
            ) : null}
          </>
        ) : (
          <View style={[styles.waitCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <ActivityIndicator color={tone.accent} />
            <Text style={[styles.centerText, { color: colors.textSecondary }]}>
              Waiting for {hostName} to start…
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Results                                                                    */
/* -------------------------------------------------------------------------- */

function Results({ state, isHost, onLeave }: { state: RoomState; isHost: boolean; onLeave: () => void }) {
  const { colors } = useTheme();
  const { meId, me, partner } = useRoomPlayers();
  const tone = useGameTone(state.game);
  const result = state.result;
  const hostName = firstName(state.players.find((p) => p.id === state.hostId)?.name);

  const rows = [
    { id: meId, name: me.name, avatar: me.avatar },
    { id: partner.id, name: partner.name, avatar: partner.avatar },
  ]
    .map((r) => ({ ...r, score: state.scores[r.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <View style={styles.results}>
      <Confetti burstKey={state.v} />
      <Animated.Text entering={ZoomIn.springify().damping(9)} style={styles.trophy}>
        {result?.teamGame ? '💞' : '🏆'}
      </Animated.Text>
      <RoundEnter delay={100}>
        <Text style={[styles.resultHeadline, { color: colors.text }]}>{result?.headline ?? 'Game over'}</Text>
      </RoundEnter>

      <RoundEnter delay={200}>
        <View style={[styles.xpChip, { backgroundColor: tone.soft, borderColor: tone.accent }]}>
          <Text style={[styles.xpChipText, { color: tone.accent }]}>+{result?.xp ?? 0} XP for your couple</Text>
        </View>
      </RoundEnter>

      <RoundEnter delay={300}>
        <View style={[styles.board, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          {rows.map((row, i) => (
            <View key={row.id} style={styles.boardRow}>
              <Text style={styles.boardRank}>
                {result?.teamGame ? '•' : result?.winnerId === row.id ? '👑' : i === 0 && !result?.winnerId ? '🤝' : ''}
              </Text>
              <Avatar name={row.name} imageUrl={row.avatar} size={38} />
              <Text style={[styles.boardName, { color: colors.text }]} numberOfLines={1}>
                {row.id === meId ? 'You' : firstName(row.name)}
              </Text>
              <Text style={[styles.boardScore, { color: colors.text }]}>{row.score}</Text>
            </View>
          ))}
        </View>
      </RoundEnter>

      {result?.highlights.length ? (
        <RoundEnter delay={400}>
          <View style={styles.highlights}>
            {result.highlights.map((h) => (
              <Text key={h} style={[styles.highlight, { color: colors.textSecondary }]}>
                ✨ {h}
              </Text>
            ))}
          </View>
        </RoundEnter>
      ) : null}

      <View style={styles.resultActions}>
        {isHost ? (
          <ChunkyButton label="Play again" color={tone.accent} onPress={() => gameRoom.dispatch({ t: 'rematch' })} />
        ) : (
          <View style={[styles.waitCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.centerText, { color: colors.textSecondary }]}>
              {hostName} can start another round
            </Text>
          </View>
        )}
        <ChunkyButton label="Leave room" compact color={colors.textTertiary} onPress={onLeave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingBottom: 8 },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle: { fontSize: 16, fontWeight: '900' },
  presenceRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  presenceDot: { width: 7, height: 7, borderRadius: 4 },
  presenceText: { fontSize: 12, fontWeight: '700' },
  notice: { marginHorizontal: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  noticeText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  body: { padding: 16, paddingBottom: 24, flexGrow: 1 },
  playing: { gap: 22 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 60 },
  centerTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  centerText: { fontSize: 14, fontWeight: '600', lineHeight: 20, textAlign: 'center' },
  loadingEmoji: { fontSize: 64 },
  endLink: { alignSelf: 'center', padding: 8 },
  endLinkText: { fontSize: 13, fontWeight: '700' },
  reactionDock: { paddingTop: 6, alignItems: 'center' },
  lobby: { gap: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1.4, marginTop: 4 },
  lobbyHint: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  gameList: { gap: 10 },
  gameCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 2,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  gameEmoji: { fontSize: 30, width: 40, textAlign: 'center' },
  gameTitle: { fontSize: 16, fontWeight: '900' },
  gameTagline: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  modeChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  modeChipText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  vibeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  vibeEmoji: { fontSize: 16 },
  vibeLabel: { fontSize: 14, fontWeight: '800' },
  roundChip: { borderRadius: 14, borderWidth: 2, minWidth: 54, paddingVertical: 10, alignItems: 'center' },
  roundChipText: { fontSize: 16, fontWeight: '900' },
  topicInput: { borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontWeight: '600' },
  startWrap: { gap: 10, marginTop: 8 },
  waitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  results: { alignItems: 'center', gap: 14, paddingTop: 12 },
  trophy: { fontSize: 76 },
  resultHeadline: { fontSize: 26, fontWeight: '900', textAlign: 'center' },
  xpChip: { borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 8 },
  xpChipText: { fontSize: 14, fontWeight: '900' },
  board: { alignSelf: 'stretch', borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 12 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boardRank: { width: 22, fontSize: 18, textAlign: 'center' },
  boardName: { flex: 1, fontSize: 16, fontWeight: '800' },
  boardScore: { fontSize: 22, fontWeight: '900' },
  highlights: { gap: 6, alignSelf: 'stretch' },
  highlight: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  resultActions: { alignSelf: 'stretch', gap: 12, marginTop: 10 },
});
