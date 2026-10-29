import * as Haptics from '@/lib/haptics';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { PLAY_TONES, type PlayToneId } from '@/components/activities/explore/explore-catalog';
import { shade } from '@/components/games/room-ui';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import type { HandpickedFormat } from '@/lib/handpicked';

import { BrowseArt, type BrowseArtId } from './BrowseArt';
import { goLive } from './LiveStrip';

type BrowseItem = { id: BrowseArtId; label: string; tone: PlayToneId; format?: HandpickedFormat | 'games' | 'all' };

const ITEMS: BrowseItem[] = [
  // Everything in one place: every question, quiz, card, thing to do and game.
  { id: 'all', label: 'Activities', tone: 'berry', format: 'all' },
  { id: 'questions', label: 'Questions', tone: 'plum', format: 'questions' },
  { id: 'games', label: 'Games', tone: 'sky', format: 'games' },
  { id: 'prompts', label: 'Cards', tone: 'coral', format: 'prompts' },
  { id: 'quizzes', label: 'Quizzes', tone: 'amber', format: 'quizzes' },
  { id: 'together', label: 'Together', tone: 'sage', format: 'activities' },
  { id: 'live', label: 'Live', tone: 'rose' },
];

/** Round shortcuts into each kind of play, between Today's Question and the tabs. */
export function BrowseRow() {
  const router = useRouter();
  const { colors } = useTheme();

  const open = (item: BrowseItem) => {
    void Haptics.selectionAsync();
    if (item.format) router.push({ pathname: '/play/format/[id]', params: { id: item.format } });
    else if (item.id === 'live') goLive();
  };

  return (
    <ScrollView
      horizontal
      alwaysBounceHorizontal={false}
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}>
      {ITEMS.map((item) => {
        const tone = PLAY_TONES[item.tone];
        const paper = tone.wash[1];
        return (
          <Pressable
            key={item.id}
            onPress={() => open(item)}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            style={({ pressed }) => [styles.item, { transform: [{ scale: pressed ? 0.94 : 1 }] }]}>
            <View style={[styles.circle, { backgroundColor: paper }]}>
              <BrowseArt id={item.id} ink={shade(tone.accent, -0.12)} paper={paper} />
            </View>
            <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Bleed to the screen edges so the row scrolls under the gutter.
  scroll: { marginHorizontal: -Spacing.lg },
  row: { paddingHorizontal: Spacing.lg, gap: 14 },
  item: { width: 84, alignItems: 'center', gap: 9 },
  circle: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 14, fontWeight: '700', letterSpacing: -0.1 },
});
