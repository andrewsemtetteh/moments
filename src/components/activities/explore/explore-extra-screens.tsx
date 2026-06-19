import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import {
  MEMORY_QUIZ,
  pickPlaylistPrompt,
  pickTruthOrDare,
} from '@/constants/activity-content';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { addCompliment, drawCompliment, fetchCompliments, type ComplimentNote } from '@/lib/compliment-jar';
import { useRelationshipStore } from '@/stores';

import { exploreStyles as s } from './explore-styles';

export function ComplimentJarScreen() {
  const { colors } = useTheme();
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const partnerName = getFirstName(partner?.name) ?? 'your partner';
  const [text, setText] = useState('');
  const [notes, setNotes] = useState<ComplimentNote[]>([]);
  const [drawn, setDrawn] = useState<ComplimentNote | null>(null);

  const load = useCallback(async () => {
    if (!relationship?.id) return;
    setNotes(await fetchCompliments(relationship.id));
  }, [relationship?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!text.trim() || !relationship?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotes(await addCompliment(relationship.id, text.trim()));
    setText('');
  };

  const draw = async () => {
    if (!relationship?.id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const note = await drawCompliment(relationship.id);
    if (!note) {
      Alert.alert('Jar is empty', `Add a compliment for ${partnerName} first.`);
      return;
    }
    setDrawn(note);
  };

  return (
    <View style={s.stack}>
      <View style={[s.inputCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <TextInput
          style={[s.input, { color: colors.text }]}
          placeholder={`Something you love about ${partnerName}…`}
          placeholderTextColor={colors.textTertiary}
          value={text}
          onChangeText={setText}
          multiline
        />
        <Pressable onPress={() => void save()} style={[s.inputBtn, { backgroundColor: colors.accent }]}>
          <Icon name="plus" size={22} color={colors.onAccent} />
        </Pressable>
      </View>

      {drawn ? (
        <LinearGradient colors={colors.gradient} style={s.promptCard}>
          <Text style={s.dailyLabel}>For {partnerName}</Text>
          <Text style={s.promptText}>{drawn.text}</Text>
        </LinearGradient>
      ) : null}

      <PrimaryButton label={drawn ? 'Draw another' : 'Draw a compliment'} onPress={() => void draw()} />

      {notes.length > 0 ? (
        <Text style={[s.hintText, { color: colors.textTertiary }]}>{notes.length} note(s) in the jar</Text>
      ) : null}
    </View>
  );
}

export function TwoTruthsScreen() {
  const { colors } = useTheme();
  const partner = useRelationshipStore((s) => s.partner);
  const partnerName = getFirstName(partner?.name) ?? 'your partner';
  const [statements, setStatements] = useState(['', '', '']);
  const [lieIndex, setLieIndex] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);

  const update = (i: number, v: string) => {
    setStatements((prev) => prev.map((s, idx) => (idx === i ? v : s)));
  };

  const startRound = () => {
    const filled = statements.every((t) => t.trim());
    if (lieIndex === null || !filled) {
      Alert.alert('Almost there', 'Write three statements and mark which one is the lie.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRevealed(true);
  };

  const reset = () => {
    setStatements(['', '', '']);
    setLieIndex(null);
    setRevealed(false);
  };

  return (
    <View style={s.stack}>
      <Text style={[s.hintText, { color: colors.textSecondary }]}>
        Write 2 truths and 1 lie — {partnerName} guesses which is false.
      </Text>
      {[0, 1, 2].map((i) => (
        <Pressable
          key={i}
          onPress={() => !revealed && setLieIndex(i)}
          style={[
            s.gratitudeRow,
            {
              backgroundColor:
                lieIndex === i ? colors.accentSoft : colors.surfaceElevated,
              borderColor: lieIndex === i ? colors.accent : colors.border,
            },
          ]}>
          <Text style={[s.gratitudeNum, { color: colors.accent }]}>{i + 1}</Text>
          {revealed ? (
            <Text style={[s.listText, { color: colors.text }]}>
              {statements[i]}
              {lieIndex === i ? '  (the lie)' : ''}
            </Text>
          ) : (
            <TextInput
              style={[s.gratitudeInput, { color: colors.text }]}
              placeholder="A statement…"
              placeholderTextColor={colors.textTertiary}
              value={statements[i]}
              onChangeText={(v) => update(i, v)}
            />
          )}
        </Pressable>
      ))}
      {!revealed ? (
        <PrimaryButton label="Reveal to partner" onPress={startRound} />
      ) : (
        <PrimaryButton label="Play again" onPress={reset} />
      )}
    </View>
  );
}

export function TruthOrDareScreen() {
  const { colors } = useTheme();
  const [mode, setMode] = useState<'truth' | 'dare'>('truth');
  const [card, setCard] = useState(() => pickTruthOrDare('truth'));

  const pull = (next: 'truth' | 'dare') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMode(next);
    setCard(pickTruthOrDare(next));
  };

  return (
    <View style={s.stack}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(['truth', 'dare'] as const).map((m) => (
          <Pressable
            key={m}
            onPress={() => pull(m)}
            style={[
              s.tab,
              {
                flex: 1,
                backgroundColor: mode === m ? colors.text : colors.surfaceElevated,
                borderColor: mode === m ? colors.text : colors.border,
              },
            ]}>
            <Text style={[s.tabText, { color: mode === m ? colors.background : colors.textSecondary, textAlign: 'center' }]}>
              {m === 'truth' ? 'Truth' : 'Dare'}
            </Text>
          </Pressable>
        ))}
      </View>
      <LinearGradient colors={colors.gradient} style={s.promptCard}>
        <Text style={s.dailyLabel}>{mode === 'truth' ? 'Truth' : 'Dare'}</Text>
        <Text style={s.promptText}>{card}</Text>
      </LinearGradient>
      <PrimaryButton label="Another card" onPress={() => pull(mode)} />
    </View>
  );
}

export function MemoryQuizScreen() {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const item = MEMORY_QUIZ[index];

  const next = () => setIndex((i) => (i + 1) % MEMORY_QUIZ.length);

  return (
    <View style={s.stack}>
      <Text style={[s.progressLabel, { color: colors.textSecondary }]}>
        Memory {index + 1} of {MEMORY_QUIZ.length}
      </Text>
      <View style={[s.quizBlock, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Text style={[s.quizQ, { color: colors.text }]}>{item.question}</Text>
        <Text style={[s.hintText, { color: colors.textSecondary, marginTop: 8 }]}>{item.hint}</Text>
      </View>
      <PrimaryButton
        label="Next question"
        onPress={() => {
          Haptics.selectionAsync();
          next();
        }}
      />
    </View>
  );
}

export function PlaylistForTwoScreen() {
  const { colors } = useTheme();
  const partner = useRelationshipStore((s) => s.partner);
  const partnerName = getFirstName(partner?.name) ?? 'your partner';
  const [prompt, setPrompt] = useState(() => pickPlaylistPrompt());
  const [song, setSong] = useState('');

  return (
    <View style={s.stack}>
      <LinearGradient colors={colors.gradient} style={s.promptCard}>
        <Text style={s.dailyLabel}>Tonight&apos;s prompt</Text>
        <Text style={s.promptText}>{prompt}</Text>
      </LinearGradient>
      <View style={[s.inputCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <TextInput
          style={[s.input, { color: colors.text }]}
          placeholder="Song title & artist…"
          placeholderTextColor={colors.textTertiary}
          value={song}
          onChangeText={setSong}
        />
      </View>
      <PrimaryButton
        label="Share with partner"
        onPress={() => {
          if (!song.trim()) {
            Alert.alert('Add a song', 'Type a track to share.');
            return;
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Nice pick', `Tell ${partnerName}: “${song.trim()}” — ${prompt}`);
          setSong('');
        }}
      />
      <PrimaryButton
        label="New prompt"
        onPress={() => {
          Haptics.selectionAsync();
          setPrompt(pickPlaylistPrompt());
        }}
      />
    </View>
  );
}
