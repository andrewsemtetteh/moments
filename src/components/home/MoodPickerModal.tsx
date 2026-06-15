import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]} onPress={() => undefined}>
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 12,
    maxHeight: '72%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 18,
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
