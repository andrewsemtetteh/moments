import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MOOD_EMOJI, MOOD_LABELS } from '@/constants/design-system';
import { useMoodFrequency } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores';

export function MoodHistoryModal() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const visible = useUIStore((s) => s.showMoodHistory);
  const setVisible = useUIStore((s) => s.setShowMoodHistory);
  const { data: moodFreq = [] } = useMoodFrequency();
  const { isPlus, requirePlus } = usePlusGate();

  if (!visible) return null;

  const close = () => setVisible(false);

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={close}>
            <Text style={{ color: colors.textSecondary }}>Close</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Mood history</Text>
          <View style={{ width: 48 }} />
        </View>
        {!isPlus ? (
          <View style={styles.preview}>
            <Text style={[styles.body, { color: colors.textSecondary }]}>
              See how your moods shift over time with a full history chart. Included with Moments Plus.
            </Text>
            <Pressable onPress={() => requirePlus('Mood history')}>
              <Text style={{ color: colors.accent, fontWeight: '700', fontSize: 16 }}>Unlock with Plus</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.scroll}>
            {moodFreq.length === 0 ? (
              <Text style={{ color: colors.textSecondary }}>Log moods on Home to build your history.</Text>
            ) : (
              moodFreq.map((mood, index) => (
                <View key={mood} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={styles.rank}>{index + 1}</Text>
                  <Text style={styles.emoji}>{MOOD_EMOJI[mood] ?? '✨'}</Text>
                  <Text style={[styles.label, { color: colors.text }]}>{MOOD_LABELS[mood] ?? mood}</Text>
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontSize: 17, fontWeight: '700' },
  preview: { flex: 1, padding: 24, justifyContent: 'center', gap: 16 },
  body: { fontSize: 16, lineHeight: 24, textAlign: 'center' },
  scroll: { padding: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  rank: { width: 24, fontWeight: '800', color: '#888' },
  emoji: { fontSize: 24 },
  label: { fontSize: 16, fontWeight: '600' },
});
