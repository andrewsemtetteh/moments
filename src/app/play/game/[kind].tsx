import * as Haptics from 'expo-haptics';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { firstName } from '@/components/games/room-ui';
import { PlayHeader } from '@/components/play/PlayHeader';
import { useActiveGameSessions } from '@/hooks/play-queries';
import { useTheme } from '@/hooks/useTheme';
import { gameRoom } from '@/lib/game-room/manager';
import { startOwnTimeGame } from '@/lib/game-room/sessions';
import { LIVE_GAMES, VIBES, getGameDefinition, type LiveGameKind, type Vibe } from '@/lib/game-room/types';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { useGameRoomStore } from '@/stores/game-room-store';

type Mode = 'own' | 'live';

export default function GameSetupScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const partnerOnline = useGameRoomStore((s) => s.partnerOnline);
  const { data: sessions } = useActiveGameSessions();

  const def = LIVE_GAMES.find((g) => g.kind === kind) ? getGameDefinition(kind as LiveGameKind) : null;
  const [vibe, setVibe] = useState<Vibe>('playful');
  const [rounds, setRounds] = useState(def?.defaultRounds ?? 8);
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<Mode>('own');
  const [starting, setStarting] = useState(false);

  if (!def) return <Redirect href="/(tabs)/activities" />;
  const tone = PLAY_TONES[def.tone];
  const partnerName = firstName(partner?.name);
  const inProgress = sessions?.find((s) => s.game_type === def.kind);

  const start = async () => {
    if (!user || !partner || !relationshipId) {
      Alert.alert('Connect with your partner', 'Games are for two. Link up with your partner first.');
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (mode === 'live') {
      await gameRoom.openRoom(def.kind);
      const room = useGameRoomStore.getState().state;
      if (room && room.hostId === user.id && room.phase === 'lobby') {
        gameRoom.dispatch({ t: 'configure', game: def.kind, vibe, rounds, topic });
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
      });
      router.replace({ pathname: '/play/session/[id]', params: { id: session.id } });
    } catch (e) {
      Alert.alert('Couldn’t start the game', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setStarting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 92 }}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: tone.accent }}>
          <PlayHeader title={def.title} onColor="#FFFFFF" />
        </View>
        <View style={[styles.hero, { backgroundColor: tone.accent }]}>
          <View style={styles.heroBody}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillText}>{def.team ? 'TEAM GAME' : 'VERSUS'}</Text>
            </View>
            <Text style={styles.heroBlurb}>{def.tagline}</Text>
          </View>
        </View>

        <View style={styles.body}>
          {inProgress ? (
            <Pressable
              onPress={() => router.replace({ pathname: '/play/session/[id]', params: { id: inProgress.id } })}
              accessibilityRole="button"
              style={[styles.resume, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
              <Text style={[styles.resumeText, { color: colors.text }]}>
                You have a game in progress · round {Math.min(inProgress.state.round + 1, inProgress.state.totalRounds)} of{' '}
                {inProgress.state.totalRounds}
              </Text>
              <Text style={[styles.resumeCta, { color: colors.accent }]}>Continue</Text>
            </Pressable>
          ) : null}

          <Text style={[styles.label, { color: colors.textSecondary }]}>Vibe</Text>
          <View style={styles.chipRow}>
            {VIBES.map((v) => (
              <Option key={v.id} label={`${v.emoji} ${v.label}`} selected={vibe === v.id} onPress={() => setVibe(v.id)} />
            ))}
          </View>

          {def.usesTopic ? (
            <>
              <Text style={[styles.label, { color: colors.textSecondary }]}>Topic (optional)</Text>
              <TextInput
                value={topic}
                onChangeText={setTopic}
                placeholder="Anything: 90s movies, us, space…"
                placeholderTextColor={colors.textTertiary}
                maxLength={60}
                accessibilityLabel="Topic"
                style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}
              />
            </>
          ) : null}

          <Text style={[styles.label, { color: colors.textSecondary }]}>Rounds</Text>
          <View style={styles.chipRow}>
            {def.roundOptions.map((n) => (
              <Option key={n} label={String(n)} selected={rounds === n} onPress={() => setRounds(n)} wide />
            ))}
          </View>

          <Text style={[styles.label, { color: colors.textSecondary }]}>How do you want to play?</Text>
          <ModeCard
            title="On our own time"
            sub={`Answer when you’re free. ${partnerName} gets a nudge.`}
            selected={mode === 'own'}
            onPress={() => setMode('own')}
          />
          <ModeCard
            title="Live session"
            sub={partnerOnline ? `${partnerName} is online · same time, with voice` : `Same time, with voice · we’ll invite ${partnerName}`}
            online={partnerOnline}
            selected={mode === 'live'}
            onPress={() => setMode('live')}
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
        <Pressable
          onPress={() => void start()}
          disabled={starting}
          accessibilityRole="button"
          style={[styles.primary, { backgroundColor: colors.accent, opacity: starting ? 0.7 : 1 }]}>
          {starting ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={[styles.primaryText, { color: colors.onAccent }]}>
              {mode === 'live' ? 'Start live session' : 'Start game'}
            </Text>
          )}
        </Pressable>
        {starting ? <Text style={[styles.hint, { color: colors.textTertiary }]}>Writing your rounds…</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function Option({ label, selected, onPress, wide }: { label: string; selected: boolean; onPress: () => void; wide?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.option,
        wide && styles.optionWide,
        {
          backgroundColor: selected ? colors.accentSoft : colors.surfaceElevated,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}>
      <Text style={[styles.optionText, { color: colors.text }]}>{label}</Text>
    </Pressable>
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
      style={[
        styles.mode,
        {
          backgroundColor: selected ? colors.accentSoft : colors.surfaceElevated,
          borderColor: selected ? colors.accent : colors.border,
        },
      ]}>
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

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingTop: 6, paddingBottom: 28 },
  heroBody: { paddingHorizontal: 24, gap: 8 },
  heroBlurb: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', lineHeight: 27, letterSpacing: -0.3 },
  heroPill: { alignSelf: 'flex-start', backgroundColor: 'rgba(0,0,0,0.25)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  heroPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  body: { paddingHorizontal: 16, paddingTop: 18, gap: 10 },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 4,
  },
  resumeText: { flex: 1, fontSize: 14, fontWeight: '700' },
  resumeCta: { fontSize: 14, fontWeight: '800' },
  label: { fontSize: 15, fontWeight: '800', marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 14, paddingVertical: 10 },
  optionWide: { minWidth: 64, alignItems: 'center' },
  optionText: { fontSize: 14, fontWeight: '700' },
  input: {
    height: 50,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  mode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  modeTitle: { fontSize: 15, fontWeight: '800' },
  modeSubRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modeSub: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
  onlineDot: { width: 7, height: 7, borderRadius: 4 },
  radio: { width: 20, height: 20, borderRadius: 10 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 10, gap: 6 },
  primary: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 17, fontWeight: '800' },
  hint: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
