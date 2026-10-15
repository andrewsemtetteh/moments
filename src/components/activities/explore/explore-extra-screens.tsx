import * as Haptics from '@/lib/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Text, View } from 'react-native';
import { TextInput } from '@/components/ui/ThemedTextInput';

import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import {
  MEMORY_QUIZ,
  pickPlaylistPrompt,
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
          Alert.alert('Nice pick', `Tell ${partnerName}: “${song.trim()}”. ${prompt}`);
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
