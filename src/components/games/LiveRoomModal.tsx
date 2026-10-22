import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  ZoomIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { KeyboardFormScrollView } from '@/components/layout/KeyboardFormScrollView';
import { PLAY_GUTTER, PlayChip, PlayType, playCardStyle, playEdge } from '@/components/play/PlayKit';
import { RoundPicker } from '@/components/play/RoundPicker';
import { UNLIMITED_ROUNDS } from '@/lib/game-room/reducer';
import { RivalryCard, SyncBestLine } from '@/components/play/Versus';
import { askChoice, ChoiceSheetHost } from '@/components/ui/ChoiceSheet';
import { Crown } from '@/components/ui/Crown';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { Avatar, colorWithAlpha } from '@/components/ui/primitives';
import { ThemedStatusBar } from '@/components/ui/ThemedStatusBar';
import { TextInput } from '@/components/ui/ThemedTextInput';
import { useTheme } from '@/hooks/useTheme';
import { gameRoom } from '@/lib/game-room/manager';
import { LIVE_GAMES, VIBES, getGameDefinition, type RoomState } from '@/lib/game-room/types';
import { useGameRoomStore } from '@/stores/game-room-store';

import { CelebrationHost, Confetti } from './Celebration';
import { ChoicePanel, GuessPanel, LikelyPanel, QuizPanel, TruthDarePanel, TwoTruthsPanel } from './room-panels';
import {
  ChunkyButton,
  FloatingReactions,
  ReactionBar,
  ScoreHeader,
  VoiceButton,
  firstName,
  shade,
  useGameTone,
  useRoomPlayers,
  useVoiceStatus,
} from './room-ui';

const OPEN_SPRING = { damping: 30, stiffness: 280, mass: 0.9 };

/**
 * Full-screen live game room: lobby → rounds → results, with voice chat and reactions. It slides
 * in from the right like any page, and goes back with the back arrow, a swipe right, or Android
 * back (asking first when you're hosting a game in progress, since that ends it for you both).
 */
export function LiveRoomModal() {
  // Read live, so a fold / unfold, split screen or rotation redraws at the new size.
  const SCREEN_W = useWindowDimensions().width;
  const open = useGameRoomStore((s) => s.open);
  const state = useGameRoomStore((s) => s.state);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { meId, partner } = useRoomPlayers();
  const partnerInRoom = useGameRoomStore((s) => s.partnerInRoom);
  const notice = useGameRoomStore((s) => s.notice);
  const tone = useGameTone(state?.game ?? 'wouldYouRather');
  const voice = useVoiceStatus();

  const isHost = !!state && state.hostId === meId;
  const inGame = !!state && (state.phase === 'playing' || state.phase === 'loading');

  const translateX = useSharedValue(SCREEN_W);
  useEffect(() => {
    if (open) {
      translateX.set(SCREEN_W);
      translateX.set(withSpring(0, OPEN_SPRING));
    }
    // Slides in when it opens (not again when the screen size changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, translateX]);

  /** Slide away, then leave the room. */
  const leaveNow = () => {
    translateX.set(
      withTiming(SCREEN_W, { duration: 220 }, (done) => {
        if (done) runOnJS(leaveRoom)();
      }),
    );
  };

  /** Back arrow, swipe or Android back: hosts in a game are asked first (it ends it for both). */
  const leave = () => {
    if (isHost && inGame) {
      translateX.set(withSpring(0, OPEN_SPRING));
      askChoice({
        title: 'End the game?',
        message: 'You’re hosting, so leaving closes the room for both of you.',
        cancelLabel: 'Keep playing',
        actions: [{ label: 'End & leave', destructive: true, onPress: leaveNow }],
      });
      return;
    }
    leaveNow();
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

  // Swipe right anywhere to go back. Only a clearly sideways drag counts, so the room still scrolls.
  const swipeBack = Gesture.Pan()
    .activeOffsetX(14)
    .failOffsetX(-10)
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      translateX.set(Math.max(0, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX > SCREEN_W * 0.3 || e.velocityX > 700) {
        runOnJS(leave)();
        return;
      }
      translateX.set(withSpring(0, OPEN_SPRING));
    });
  const pageStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));

  if (!open) return null;

  const def = state ? getGameDefinition(state.game) : null;

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={leave}>
      <ThemedStatusBar />
      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={swipeBack}>
          <Animated.View style={[styles.root, { backgroundColor: colors.background }, pageStyle]}>
            {/* The game's colour washes the top of the page, softer on light themes. */}
            <LinearGradient
              pointerEvents="none"
              colors={[colorWithAlpha(tone.accent, colors.isDark ? 0.32 : 0.22), colorWithAlpha(tone.accent, 0)]}
              style={[styles.wash, { height: insets.top + 220 }]}
            />

            {/* Back · title and who's here · mute. Both buttons are 44 wide, so the title is centred. */}
            <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
              <HeaderIconButton icon="chevronLeft" onPress={leave} accessibilityLabel="Leave room" />
              <View style={styles.headerCenter}>
                <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                  {def ? `${def.emoji} ${def.title}` : 'Live room'}
                </Text>
                <View style={styles.presenceRow}>
                  <View
                    style={[
                      styles.presenceDot,
                      { backgroundColor: partnerInRoom ? colors.success : colors.textTertiary },
                    ]}
                  />
                  <Text style={[styles.presenceText, { color: colors.textSecondary }]} numberOfLines={1}>
                    {partnerInRoom ? `${firstName(partner.name)} is here` : `Waiting for ${firstName(partner.name)}`}
                    {' · '}
                    <Text style={{ color: voice.color }}>{voice.label}</Text>
                  </Text>
                </View>
              </View>
              <VoiceButton onToggleMute={() => gameRoom.setMuted(!useGameRoomStore.getState().muted)} />
            </View>

            {notice ? (
              <Animated.View entering={FadeIn} style={[styles.notice, playCardStyle(colors)]}>
                <Text style={[styles.noticeText, { color: colors.text }]}>{notice}</Text>
              </Animated.View>
            ) : null}

            <View style={styles.root}>
              <KeyboardFormScrollView
                // The field you tap comes above the keyboard, and the page scrolls on to its last button.
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
                    {/* Unlimited: finishing is how it ends, so it goes to the results (either of you). */}
                    {state.endless && isHost ? (
                      <Pressable
                        onPress={() => gameRoom.dispatch({ t: 'end' })}
                        style={({ pressed }) => [styles.finishBtn, { backgroundColor: tone.accent }, pressed && { opacity: 0.85 }]}
                        accessibilityRole="button">
                        <Text style={styles.finishText}>Finish & see results</Text>
                      </Pressable>
                    ) : null}
                    {isHost ? (
                      <Pressable onPress={leave} style={styles.endLink} accessibilityRole="button">
                        <Text style={[styles.endLinkText, { color: colors.textTertiary }]}>End game</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : (
                  <Results state={state} onLeave={leave} />
                )}
              </KeyboardFormScrollView>
            </View>

            {/* Reactions all through the room: lobby, rounds and results. */}
            <View style={[styles.reactionDock, { paddingBottom: insets.bottom + 10 }]}>
              <ReactionBar onReact={(emoji) => gameRoom.react(emoji)} />
            </View>

            <FloatingReactions />
            <CelebrationHost surface="room" />
          </Animated.View>
        </GestureDetector>
        {/* "End the game?" shows inside the room (a drawer from the app root couldn't). */}
        <ChoiceSheetHost inline />
      </GestureHandlerRootView>
    </Modal>
  );
}

function leaveRoom() {
  void gameRoom.leaveRoom();
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
  const them = firstName(partner.name);
  // The full list only when choosing: the loser's pick after a game, or Change game.
  const [browsing, setBrowsing] = useState(false);
  const choosing = browsing || !!state.picker;
  // A game got set (you both picked it, or the loser chose): back to just that game.
  const [shownGame, setShownGame] = useState(state.game);
  if (state.game !== shownGame) {
    setShownGame(state.game);
    setBrowsing(false);
  }

  const configure = (
    patch: Partial<{ game: typeof state.game; vibe: typeof state.vibe; rounds: number; topic: string }>,
  ) => {
    const game = patch.game ?? state.game;
    gameRoom.dispatch({
      t: 'configure',
      game,
      vibe: patch.vibe ?? state.vibe,
      // Keeps Unlimited (0) when only the vibe or topic changes.
      rounds:
        patch.rounds ??
        (patch.game ? getGameDefinition(game).defaultRounds : state.endless ? UNLIMITED_ROUNDS : state.totalRounds),
      topic: patch.topic ?? state.topic,
    });
  };

  return (
    <View style={styles.lobby}>
      {state.message ? <Text style={[styles.centerText, { color: colors.error }]}>{state.message}</Text> : null}

      <View style={styles.section}>
        <Text style={[PlayType.section, { color: colors.text }]}>
          {state.picker === meId
            ? 'Your pick'
            : state.picker
              ? `${them} picks`
              : choosing
                ? 'Pick a game together'
                : 'Your game'}
        </Text>
        <Text style={[PlayType.body, { color: colors.textSecondary }]}>
          {state.picker === meId
            ? 'You lost that one, so you choose what’s next.'
            : state.picker
              ? `${them} lost that one, so they choose what’s next.`
              : choosing
                ? 'Tap to suggest. When you both pick the same one, it’s set.'
                : isHost
                  ? `Set the vibe and rounds, then start when ${them} joins.`
                  : `${hostName} sets the vibe and rounds, then starts the game.`}
        </Text>
      </View>

      {!choosing ? (
        <View style={styles.gameList}>
          <GameCard game={def} selected iWant={false} theyWant={false} them={them} disabled onPress={() => undefined} />
          <Pressable onPress={() => setBrowsing(true)} accessibilityRole="button" hitSlop={8} style={styles.changeGame}>
            <Text style={[styles.changeGameText, { color: colors.accent }]}>Change game</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.gameList}>
          {LIVE_GAMES.map((game) => (
            <GameCard
              key={game.kind}
              game={game}
              selected={game.kind === state.game}
              iWant={state.suggestions?.[meId] === game.kind}
              theyWant={state.suggestions?.[partner.id] === game.kind}
              them={them}
              disabled={!!state.picker && state.picker !== meId}
              onPress={() => gameRoom.dispatch({ t: 'suggest', game: game.kind })}
            />
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={[PlayType.label, { color: colors.textSecondary }]}>Vibe</Text>
        <View style={styles.chipRow}>
          {VIBES.map((v) => (
            <PlayChip
              key={v.id}
              label={`${v.emoji} ${v.label}`}
              selected={v.id === state.vibe}
              disabled={!isHost}
              onPress={() => configure({ vibe: v.id })}
            />
          ))}
        </View>
      </View>

      {def.usesTopic ? (
        <View style={styles.section}>
          <Text style={[PlayType.label, { color: colors.textSecondary }]}>Quiz topic</Text>
          <TextInput
            editable={isHost}
            value={state.topic}
            onChangeText={(topic) => configure({ topic })}
            placeholder="Anything: 90s movies, us, space…"
            placeholderTextColor={colors.textTertiary}
            maxLength={60}
            style={[
              styles.topicInput,
              {
                color: colors.text,
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
                borderWidth: playEdge(colors),
              },
            ]}
          />
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={[PlayType.label, { color: colors.textSecondary }]}>Rounds</Text>
        <RoundPicker
          options={def.roundOptions}
          value={state.endless ? UNLIMITED_ROUNDS : state.totalRounds}
          disabled={!isHost}
          onChange={(n) => configure({ rounds: n })}
        />
        {!isHost ? (
          <Text style={[PlayType.body, { color: colors.textTertiary }]}>{hostName} sets the vibe and rounds.</Text>
        ) : null}
      </View>

      <View style={styles.startWrap}>
        {isHost ? (
          <>
            <ChunkyButton
              label={partnerInRoom ? 'Start game' : `Waiting for ${them}…`}
              color={tone.accent}
              disabled={!partnerInRoom}
              onPress={() => gameRoom.dispatch({ t: 'begin' })}
            />
            {!partnerInRoom ? (
              <Text style={[styles.centerText, { color: colors.textTertiary }]}>
                We’ve pinged {them}. The game starts as soon as they join.
              </Text>
            ) : null}
          </>
        ) : (
          <View style={[styles.waitCard, playCardStyle(colors)]}>
            <ActivityIndicator color={tone.accent} />
            <Text style={[PlayType.body, { color: colors.textSecondary }]}>Waiting for {hostName} to start…</Text>
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * One game in the lobby: emoji tile · title and tagline · a tag (Team / Versus, or who wants it),
 * all centred on one line. The chosen game fills with its colour.
 */
function GameCard({
  game,
  selected,
  iWant,
  theyWant,
  them,
  disabled,
  onPress,
}: {
  game: (typeof LIVE_GAMES)[number];
  selected: boolean;
  iWant: boolean;
  theyWant: boolean;
  them: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const t = PLAY_TONES[game.tone];
  const tag = theyWant ? `${them} wants` : iWant ? 'You want' : game.team ? 'Team' : 'Versus';
  const voted = theyWant || iWant;
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${game.title}, ${tag}`}
      style={({ pressed }) => [
        styles.gameCard,
        selected
          ? { backgroundColor: t.accent, borderColor: shade(t.accent, -0.3), borderWidth: playEdge(colors) }
          : { ...playCardStyle(colors), borderColor: voted ? t.accent : colors.border },
        { borderBottomWidth: pressed ? 2 : 4, opacity: disabled && !selected ? 0.6 : 1 },
      ]}>
      <View style={[styles.gameTile, { backgroundColor: selected ? 'rgba(255,255,255,0.2)' : t.soft }]}>
        <Text style={styles.gameEmoji}>{game.emoji}</Text>
      </View>
      <View style={styles.gameText}>
        <Text style={[PlayType.title, { color: selected ? '#FFFFFF' : colors.text }]} numberOfLines={1}>
          {game.title}
        </Text>
        <Text
          style={[styles.gameTagline, { color: selected ? 'rgba(255,255,255,0.85)' : colors.textSecondary }]}
          numberOfLines={1}>
          {game.tagline}
        </Text>
      </View>
      <View style={[styles.modeChip, { backgroundColor: selected ? 'rgba(255,255,255,0.22)' : t.soft }]}>
        <Text style={[styles.modeChipText, { color: selected ? '#FFFFFF' : t.accent }]} numberOfLines={1}>
          {tag.toUpperCase()}
        </Text>
      </View>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* Results                                                                    */
/* -------------------------------------------------------------------------- */

function Results({ state, onLeave }: { state: RoomState; onLeave: () => void }) {
  const { colors } = useTheme();
  const { meId, me, partner } = useRoomPlayers();
  const tone = useGameTone(state.game);
  const result = state.result;
  // Who picks the next game: whoever lost (either of you after a tie or a team game).
  const loserId = result?.winnerId ? state.players.find((p) => p.id !== result.winnerId)?.id : null;
  const pickLabel = !loserId
    ? 'Pick another game'
    : loserId === meId
      ? 'Your pick: next game'
      : `${firstName(partner.name)} picks next`;

  const rows = [
    { id: meId, name: me.name, avatar: me.avatar },
    { id: partner.id, name: partner.name, avatar: partner.avatar },
  ]
    .map((r) => ({ ...r, score: state.scores[r.id] ?? 0 }))
    .sort((a, b) => b.score - a.score);

  return (
    <View style={styles.results}>
      <Confetti burstKey={state.v} />
      <Animated.Text entering={ZoomIn.springify().damping(14)} style={styles.trophy}>
        {result?.teamGame ? '💞' : '🏆'}
      </Animated.Text>
      <Text style={[styles.resultHeadline, { color: colors.text }]}>{result?.headline ?? 'Game over'}</Text>
      <View style={[styles.xpChip, { backgroundColor: tone.soft, borderColor: tone.accent }]}>
        <Text style={[styles.xpChipText, { color: tone.accent }]}>+{result?.xp ?? 0} XP for your couple</Text>
      </View>

      <View style={[styles.board, playCardStyle(colors)]}>
        {rows.map((row) => {
          const won = !result?.teamGame && result?.winnerId === row.id;
          return (
            <View key={row.id} style={styles.boardRow}>
              <View>
                <Avatar name={row.name} imageUrl={row.avatar} size={40} />
                {won ? (
                  <View style={styles.boardCrown} pointerEvents="none">
                    <Crown size={22} />
                  </View>
                ) : null}
              </View>
              <Text style={[styles.boardName, { color: colors.text }]} numberOfLines={1}>
                {row.id === meId ? 'You' : firstName(row.name)}
              </Text>
              <Text style={[styles.boardScore, { color: colors.text }]}>{row.score}</Text>
            </View>
          );
        })}
      </View>

      {result?.highlights.length ? (
        <View style={styles.highlights}>
          {result.highlights.map((h) => (
            <Text key={h} style={[styles.highlight, { color: colors.textSecondary }]}>
              {h}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={styles.stretch}>
        {result?.teamGame ? <SyncBestLine game={state.game} current={result.syncPct} /> : <RivalryCard compact />}
      </View>

      <View style={styles.resultActions}>
        <ChunkyButton
          label="Rematch"
          color={tone.accent}
          onPress={() => gameRoom.dispatch({ t: 'rematch', again: true })}
        />
        <ChunkyButton
          label={pickLabel}
          compact
          color={shade(tone.accent, -0.15)}
          onPress={() => gameRoom.dispatch({ t: 'rematch' })}
        />
        <ChunkyButton label="Leave room" compact color={colors.textTertiary} onPress={onLeave} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  wash: { position: 'absolute', top: 0, left: 0, right: 0 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 10 },
  headerCenter: { flex: 1, alignItems: 'center', gap: 3 },
  headerTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
  presenceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%' },
  presenceDot: { width: 7, height: 7, borderRadius: 4 },
  presenceText: { fontSize: 12, fontWeight: '700', flexShrink: 1 },
  notice: { marginHorizontal: PLAY_GUTTER, marginBottom: 6, padding: 12 },
  noticeText: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  body: { paddingHorizontal: PLAY_GUTTER, paddingTop: 8, paddingBottom: 24, flexGrow: 1 },
  playing: { gap: 22 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 60 },
  centerTitle: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  centerText: { fontSize: 14, fontWeight: '600', lineHeight: 20, textAlign: 'center' },
  loadingEmoji: { fontSize: 64 },
  endLink: { alignSelf: 'center', padding: 8 },
  finishBtn: { alignSelf: 'center', height: 44, paddingHorizontal: 22, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  finishText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  endLinkText: { fontSize: 13, fontWeight: '700' },
  reactionDock: { paddingTop: 6, alignItems: 'center' },
  lobby: { gap: 22 },
  section: { gap: 10 },
  gameList: { gap: 10 },
  changeGame: { alignSelf: 'center', paddingVertical: 4, paddingHorizontal: 8 },
  changeGameText: { fontSize: 15, fontWeight: '800' },
  gameCard: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 12 },
  gameTile: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  gameEmoji: { fontSize: 26 },
  gameText: { flex: 1, gap: 2 },
  gameTagline: { fontSize: 13, fontWeight: '600' },
  modeChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 110 },
  modeChipText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  topicInput: { height: 50, borderRadius: 16, paddingHorizontal: 14, fontSize: 16, fontWeight: '600' },
  startWrap: { gap: 10 },
  waitCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16 },
  results: { alignItems: 'center', gap: 14, paddingTop: 12 },
  trophy: { fontSize: 72 },
  resultHeadline: { fontSize: 26, fontWeight: '900', textAlign: 'center' },
  xpChip: { borderRadius: 999, borderWidth: 1.5, paddingHorizontal: 16, paddingVertical: 8 },
  xpChipText: { fontSize: 14, fontWeight: '900' },
  board: { alignSelf: 'stretch', padding: 14, gap: 14 },
  boardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  boardCrown: { position: 'absolute', top: -13, left: 0, right: 0, alignItems: 'center' },
  boardName: { flex: 1, fontSize: 16, fontWeight: '800' },
  boardScore: { fontSize: 22, fontWeight: '900' },
  highlights: { gap: 6, alignSelf: 'stretch' },
  highlight: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  stretch: { alignSelf: 'stretch' },
  resultActions: { alignSelf: 'stretch', gap: 12, marginTop: 6 },
});
