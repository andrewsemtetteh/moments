import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { MoodPickerModal } from '@/components/home/MoodPickerModal';
import { Icon } from '@/components/ui/Icon';
import { MOOD_COLORS, MOOD_EMOJI, MOOD_LABELS, type ThemeColors } from '@/constants/design-system';
import { useMoodFrequency } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getModalMoods, getQuickMoods, shouldShowMoodExpand } from '@/lib/mood-options';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { MoodLog } from '@/types/database';

interface MoodSnapshotProps {
  moods: Record<string, MoodLog>;
  onSelectMood?: (mood: string) => void;
  onViewHistory?: () => void;
}

export function MoodSnapshot({ moods, onSelectMood, onViewHistory }: MoodSnapshotProps) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const { data: frequentMoods = [] } = useMoodFrequency();
  const [showAllMoods, setShowAllMoods] = useState(false);

  const myMood = user ? moods[user.id] : null;
  const partnerMood = partner ? moods[partner.id] : null;

  const quickMoods = useMemo(
    () => getQuickMoods(frequentMoods, myMood?.mood),
    [frequentMoods, myMood?.mood],
  );
  const modalMoods = useMemo(() => getModalMoods(quickMoods), [quickMoods]);
  const showExpand = shouldShowMoodExpand(quickMoods);

  const handleSelect = (mood: string) => {
    onSelectMood?.(mood);
    setShowAllMoods(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.textSecondary, marginBottom: 0 }]}>How we&apos;re feeling</Text>
        {onViewHistory && (
          <Pressable onPress={onViewHistory} hitSlop={8}>
            <Text style={[styles.historyLink, { color: colors.accent }]}>History</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.row}>
        <MoodBubble name="You" mood={myMood?.mood} colors={colors} />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MoodBubble name={partner?.name ?? 'Partner'} mood={partnerMood?.mood} colors={colors} />
      </View>

      {onSelectMood && (
        <View style={styles.selector}>
          {quickMoods.map((m) => (
            <MoodChip key={m} mood={m} active={myMood?.mood === m} colors={colors} onPress={() => handleSelect(m)} />
          ))}
          {showExpand && (
            <Pressable
              onPress={() => setShowAllMoods(true)}
              accessibilityLabel="More moods"
              style={({ pressed }) => [
                styles.moreBtn,
                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                pressed && styles.pressed,
              ]}>
              <Icon name="plus" size={22} color={colors.accent} />
              <Text style={[styles.moreText, { color: colors.textSecondary }]} numberOfLines={1}>
                More
              </Text>
            </Pressable>
          )}
        </View>
      )}

      <MoodPickerModal
        visible={showAllMoods}
        moods={modalMoods}
        selected={myMood?.mood}
        onSelect={handleSelect}
        onClose={() => setShowAllMoods(false)}
      />
    </View>
  );
}

function MoodChip({
  mood,
  active,
  colors,
  onPress,
}: {
  mood: string;
  active: boolean;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.moodBtn,
        {
          backgroundColor: active ? MOOD_COLORS[mood] + '33' : colors.surfaceElevated,
          borderColor: active ? MOOD_COLORS[mood] : 'transparent',
        },
        pressed && styles.pressed,
      ]}>
      <Text style={styles.moodEmoji}>{MOOD_EMOJI[mood]}</Text>
      <Text style={[styles.moodText, { color: colors.textSecondary }]} numberOfLines={1}>
        {MOOD_LABELS[mood]}
      </Text>
    </Pressable>
  );
}

function MoodBubble({ name, mood, colors }: { name: string; mood?: string; colors: ThemeColors }) {
  const tint = mood ? MOOD_COLORS[mood] : colors.surfaceElevated;
  return (
    <View style={styles.bubble}>
      <View style={[styles.moodCircle, { backgroundColor: mood ? tint + '2A' : colors.surfaceElevated, borderColor: mood ? tint : colors.border }]}>
        <Text style={styles.emoji}>{mood ? MOOD_EMOJI[mood] : '·'}</Text>
      </View>
      <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
      <Text style={[styles.moodLabel, { color: colors.textSecondary }]}>{mood ? MOOD_LABELS[mood] : 'Not set'}</Text>
    </View>
  );
}

export function LoadingState() {
  const { colors } = useTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 20, padding: 18, borderWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  historyLink: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center' },
  divider: { width: 1, height: 56, marginHorizontal: 12 },
  bubble: { flex: 1, alignItems: 'center', gap: 5 },
  moodCircle: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  emoji: { fontSize: 30 },
  name: { fontSize: 15, fontWeight: '700' },
  moodLabel: { fontSize: 13 },
  selector: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    marginTop: 18,
  },
  moodBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  moodEmoji: { fontSize: 20 },
  moodText: { fontSize: 9, marginTop: 2, fontWeight: '600', textAlign: 'center' },
  moreBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  moreText: { fontSize: 9, marginTop: 2, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.7 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
});
