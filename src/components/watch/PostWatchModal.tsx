import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { WatchScreen } from '@/components/watch/WatchScreen';
import { WATCH_POST_PROMPTS } from '@/constants/watch-together';
import { useAddWatchHistory } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';

export function PostWatchModal({
  target,
  onDone,
}: {
  target: { title: string; platformId: string | null };
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const addHistory = useAddWatchHistory();

  const prompt = useMemo(
    () => WATCH_POST_PROMPTS[Math.floor(Math.random() * WATCH_POST_PROMPTS.length)],
    [],
  );

  const [rating, setRating] = useState(0);
  const [favorite, setFavorite] = useState('');
  const [answer, setAnswer] = useState('');

  const save = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addHistory.mutate(
      {
        title: target.title,
        platformId: target.platformId,
        rating: rating || undefined,
        favoriteMoment: favorite,
        promptQuestion: prompt,
        promptAnswer: answer,
      },
      { onSuccess: onDone, onError: onDone },
    );
  };

  return (
    <WatchScreen
      title="How was it?"
      onClose={onDone}
      right={
        <Pressable onPress={onDone} hitSlop={8}>
          <Text style={{ color: colors.textSecondary, fontWeight: '700', fontSize: 14 }}>Skip</Text>
        </Pressable>
      }>
      <View style={styles.hero}>
        <Text style={{ fontSize: 40 }}>🎬</Text>
        <Text style={[styles.title, { color: colors.text }]}>{target.title}</Text>
        <Text style={{ color: colors.textSecondary }}>Save this to your memories together</Text>
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>YOUR RATING</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Pressable
            key={i}
            onPress={() => {
              Haptics.selectionAsync();
              setRating(i);
            }}
            hitSlop={6}>
            <Icon name="star" size={38} color={i <= rating ? colors.warning : colors.border} filled={i <= rating} />
          </Pressable>
        ))}
      </View>

      <Text style={[styles.label, { color: colors.textSecondary }]}>FAVORITE MOMENT</Text>
      <TextInput
        value={favorite}
        onChangeText={setFavorite}
        placeholder="What scene stood out?"
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
        multiline
      />

      <Text style={[styles.label, { color: colors.textSecondary }]}>{prompt.toUpperCase()}</Text>
      <TextInput
        value={answer}
        onChangeText={setAnswer}
        placeholder="Share your answer…"
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
        multiline
      />

      <PrimaryButton label="Save to memories" onPress={save} loading={addHistory.isPending} />
    </WatchScreen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6 },
  title: { fontSize: 22, fontWeight: '900', textAlign: 'center' },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 0.6, marginTop: 4 },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  input: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 52,
  },
});
