import * as Haptics from '@/lib/haptics';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardFormScrollView } from '@/components/layout/KeyboardFormScrollView';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { TextInput } from '@/components/ui/ThemedTextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { ChunkyButton, firstName } from '@/components/games/room-ui';
import { PlayHeader } from '@/components/play/PlayHeader';
import { PLAY_GUTTER, PlayChip, PlayHero, PlayType, playCardStyle, playEdge } from '@/components/play/PlayKit';
import { RoundPicker } from '@/components/play/RoundPicker';
import { RivalryCard, SyncBestLine } from '@/components/play/Versus';
import { useActiveGameSessions } from '@/hooks/play-queries';
import { useLightStatusBar } from '@/hooks/useLightStatusBar';
import { useTheme } from '@/hooks/useTheme';
import { gameRoom } from '@/lib/game-room/manager';
import { startOwnTimeGame } from '@/lib/game-room/sessions';
import { LIVE_GAMES, VIBES, getGameDefinition, type LiveGameKind, type Vibe } from '@/lib/game-room/types';
import { requirePlusNow } from '@/lib/plus';
import { useIsPlus } from '@/hooks/useIsPlus';
import { Crown } from '@/components/ui/Crown';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { useGameRoomStore } from '@/stores/game-room-store';

type Mode = 'own' | 'live';

export default function GameSetupScreen() {
  const { kind, mode: modeParam } = useLocalSearchParams<{ kind: string; mode?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  // Coloured header with white text: light clock and battery while this page shows.
  useLightStatusBar();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const partnerOnline = useGameRoomStore((s) => s.partnerOnline);
  const { data: sessions } = useActiveGameSessions();

  const def = LIVE_GAMES.find((g) => g.kind === kind) ? getGameDefinition(kind as LiveGameKind) : null;
  const [vibe, setVibe] = useState<Vibe>('playful');
  const [rounds, setRounds] = useState(def?.defaultRounds ?? 8);
  const [topic, setTopic] = useState('');
  // From Go live the page opens set to a live session.
  const [chosenMode, setMode] = useState<Mode>(modeParam === 'live' ? 'live' : 'own');
  const [starting, setStarting] = useState(false);
  const isPlus = useIsPlus();
  // Quiz only: the last round counts double, chosen before the game.
  const [comeback, setComeback] = useState(false);

  if (!def) return <Redirect href="/(tabs)/activities" />;
  const tone = PLAY_TONES[def.tone];
  // Truth or Dare needs you both there: a dare done alone can't be seen, or a truth heard.
  const liveOnly = def.kind === 'truthDare';
  const mode: Mode = liveOnly ? 'live' : chosenMode;
  const partnerName = firstName(partner?.name);
  const inProgress = sessions?.find((s) => s.game_type === def.kind);

  const start = async () => {
    if (!user || !partner || !relationshipId) {
      Alert.alert('Connect with your partner', 'Games are for two. Link up with your partner first.');
      return;
    }
    // Endless games are written by AI: Plus (or its free trial).
    if (!requirePlusNow('AI games')) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (mode === 'live') {
      await gameRoom.openRoom(def.kind);
      const room = useGameRoomStore.getState().state;
      if (room && room.hostId === user.id && room.phase === 'lobby') {
        gameRoom.dispatch({ t: 'configure', game: def.kind, vibe, rounds, topic, doubleFinal: comeback });
      }
      router.back();
      return;
    }

    setStarting(true);
    try {
      const session = await startOwnTimeGame({
        relationshipId,
        me: { id: user.id, name: user.name ?? 'You' },
        partner: { id: partner.id, name: partner.name ?? 'Partner' },
        game: def.kind,
        vibe,
        rounds,
        topic: def.usesTopic ? topic : undefined,
        doubleFinal: def.kind === 'quiz' && comeback,
      });
      router.replace({ pathname: '/play/session/[id]', params: { id: session.id } });
    } catch (e) {
      Alert.alert('Couldn’t start the game', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardFormScrollView
        // The field you tap comes above the keyboard, and the page scrolls on to its last button.
        // Its end clears the Start button, which rides up on the keyboard.
        endGap={-insets.bottom}
        bottomOffset={FOOTER_H + 16}
        topInset={insets.top + 72}
        // No pull past the top (it showed an empty gap above the page).
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={{ paddingBottom: insets.bottom + 92 }}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: tone.accent }}>
          <PlayHeader title={def.title} onColor="#FFFFFF" />
        </View>
        <PlayHero color={tone.accent} pill={def.team ? 'Team game' : 'Versus'} blurb={def.tagline} />

        <View style={styles.body}>
          {/* Your record in versus games; your best sync in team games. */}
          {def.team ? <SyncBestLine game={def.kind} /> : <RivalryCard compact />}

          {inProgress ? (
            <Pressable
              onPress={() => router.replace({ pathname: '/play/session/[id]', params: { id: inProgress.id } })}
              accessibilityRole="button"
              style={[styles.resume, playCardStyle(colors, true)]}>
              <Text style={[styles.resumeText, { color: colors.text }]}>
                {inProgress.state.endless
                  ? `You have a game in progress · round ${inProgress.state.round + 1}`
                  : `You have a game in progress · round ${Math.min(inProgress.state.round + 1, inProgress.state.totalRounds)} of ${inProgress.state.totalRounds}`}
              </Text>
              <Text style={[styles.resumeCta, { color: colors.accent }]}>Continue</Text>
            </Pressable>
          ) : null}

          <Text style={[PlayType.label, styles.label, { color: colors.textSecondary }]}>Vibe</Text>
          <View style={styles.chipRow}>
            {VIBES.map((v) => (
              <PlayChip
                key={v.id}
                label={`${v.emoji} ${v.label}`}
                selected={vibe === v.id}
                onPress={() => setVibe(v.id)}
              />
            ))}
          </View>

          {def.usesTopic ? (
            <>
              <Text style={[PlayType.label, styles.label, { color: colors.textSecondary }]}>Topic (optional)</Text>
              <TextInput
                value={topic}
                onChangeText={setTopic}
                placeholder="Anything: 90s movies, us, space…"
                placeholderTextColor={colors.textTertiary}
                maxLength={60}
                accessibilityLabel="Topic"
                style={[
                  styles.input,
                  { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: playEdge(colors) },
                ]}
              />
            </>
          ) : null}

          <Text style={[PlayType.label, styles.label, { color: colors.textSecondary }]}>Rounds</Text>
          <RoundPicker options={def.roundOptions} value={rounds} onChange={setRounds} />

          {def.kind === 'quiz' ? (
            <>
              <Text style={[PlayType.label, styles.label, { color: colors.textSecondary }]}>Comeback round</Text>
              <View style={styles.chipRow}>
                <PlayChip label="Off" selected={!comeback} onPress={() => setComeback(false)} />
                <PlayChip label="🔥 Last round counts double" selected={comeback} onPress={() => setComeback(true)} />
              </View>
              <Text style={[styles.hint, { color: colors.textTertiary, textAlign: 'left' }]}>
                Whoever’s behind still has a shot right to the end.
              </Text>
            </>
          ) : null}

          <Text style={[PlayType.label, styles.label, { color: colors.textSecondary }]}>How do you want to play?</Text>
          {liveOnly ? (
            <Text style={[styles.hint, { color: colors.textTertiary, textAlign: 'left' }]}>
              Truth or Dare is played live, so you can hear the truths and see the dares.
            </Text>
          ) : (
            <ModeCard
              title="On our own time"
              sub={`Answer when you’re free. ${partnerName} gets a nudge.`}
              selected={mode === 'own'}
              onPress={() => setMode('own')}
            />
          )}
          <ModeCard
            title="Live session"
            sub={
              partnerOnline
                ? `${partnerName} is online · same time, with voice`
                : `Same time, with voice · we’ll invite ${partnerName}`
            }
            online={partnerOnline}
            selected={mode === 'live'}
            onPress={() => setMode('live')}
          />
        </View>
      </KeyboardFormScrollView>

      {/* Sits on the keyboard while typing (without the home-indicator gap), so Start stays in reach. */}
      <KeyboardStickyView
        offset={{ opened: insets.bottom }}
        style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
        <ChunkyButton
          // Without Plus the button says so (a tap opens the Plus page).
          label={!isPlus ? 'Unlock with Plus' : mode === 'live' ? 'Start live session' : 'Start game'}
          icon={!isPlus ? <Crown size={20} color={colors.onAccent} /> : undefined}
          color={colors.accent}
          textColor={colors.onAccent}
          loading={starting}
          onPress={() => void start()}
        />
        {starting ? <Text style={[styles.hint, { color: colors.textTertiary }]}>Writing your rounds…</Text> : null}
      </KeyboardStickyView>
    </View>
  );
}


function ModeCard({
  title,
  sub,
  selected,
  online,
  onPress,
}: {
  title: string;
  sub: string;
  selected: boolean;
  online?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={[styles.mode, playCardStyle(colors, selected)]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[styles.modeTitle, { color: colors.text }]}>{title}</Text>
        <View style={styles.modeSubRow}>
          {online ? <View style={[styles.onlineDot, { backgroundColor: colors.success }]} /> : null}
          <Text style={[styles.modeSub, { color: colors.textSecondary }]}>{sub}</Text>
        </View>
      </View>
      <View
        style={[
          styles.radio,
          { borderColor: selected ? colors.accent : colors.textTertiary, borderWidth: selected ? 6 : 2 },
        ]}
      />
    </Pressable>
  );
}

/** The footer above the keyboard: padding 10 + Start (~58) + 12. */
const FOOTER_H = 80;

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { paddingHorizontal: PLAY_GUTTER, paddingTop: 18, gap: 10 },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    marginBottom: 4,
  },
  resumeText: { flex: 1, fontSize: 14, fontWeight: '700' },
  resumeCta: { fontSize: 14, fontWeight: '800' },
  label: { marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { height: 50, borderRadius: 16, paddingHorizontal: 14, fontSize: 16 },
  mode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modeTitle: { fontSize: 15, fontWeight: '800' },
  modeSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeSub: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  radio: { width: 20, height: 20, borderRadius: 10 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: PLAY_GUTTER, paddingTop: 10, gap: 6 },
  hint: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
