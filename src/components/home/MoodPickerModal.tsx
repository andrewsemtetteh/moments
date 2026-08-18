import { ScrollView, StyleSheet, Pressable, Text } from 'react-native';

import { DraggableSheet } from '@/components/ui/DraggableSheet';
import { MOOD_COLORS, MOOD_EMOJI, MOOD_LABELS } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  visible: boolean;
  moods: string[];
  selected?: string;
  onSelect: (mood: string) => void;
  onClose: () => void;
};

export function MoodPickerModal({ visible, moods, selected, onSelect, onClose }: Props) {
  const { colors } = useTheme();

  return (
    <DraggableSheet visible={visible} onClose={onClose} style={styles.sheet}>
      <Text style={[styles.title, { color: colors.text }]}>More moods</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Pick the mood that fits best right now</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
        {moods.map((m) => {
          const active = selected === m;
          return (
            <Pressable
              key={m}
              onPress={() => {
                onSelect(m);
                onClose();
              }}
              style={[
                styles.moodItem,
                {
                  backgroundColor: active ? MOOD_COLORS[m] + '33' : colors.surface,
                  borderColor: active ? MOOD_COLORS[m] : colors.border,
                },
              ]}>
              <Text style={styles.emoji}>{MOOD_EMOJI[m]}</Text>
              <Text style={[styles.label, { color: colors.text }]}>{MOOD_LABELS[m]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable onPress={onClose} style={styles.cancel} hitSlop={8}>
        <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
      </Pressable>
    </DraggableSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
  },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 18, lineHeight: 20 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingBottom: 8,
  },
  moodItem: {
    width: '30%',
    minWidth: 96,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  emoji: { fontSize: 28 },
  label: { fontSize: 12, fontWeight: '600', marginTop: 6 },
  cancel: { alignItems: 'center', marginTop: 18 },
});
