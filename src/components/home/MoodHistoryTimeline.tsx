import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { MOOD_COLORS, MOOD_EMOJI, MOOD_LABELS, type ThemeColors } from '@/constants/design-system';
import type { MoodTimelineSection } from '@/lib/mood-history';

interface MoodHistoryTimelineProps {
  colors: ThemeColors;
  sections: MoodTimelineSection[];
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
}

export function MoodHistoryTimeline({
  colors,
  sections,
  hasNextPage,
  isFetchingNextPage,
  onLoadMore,
}: MoodHistoryTimelineProps) {
  if (sections.length === 0) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
          No mood entries yet. Log how you&apos;re feeling on Home.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {sections.map((section) => (
        <View key={section.key} style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>{section.label}</Text>
          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {section.entries.map((entry, index) => {
              const tint = MOOD_COLORS[entry.mood] ?? colors.accent;
              const isLast = index === section.entries.length - 1;
              return (
                <View
                  key={entry.id}
                  style={[
                    styles.row,
                    !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
                  ]}>
                  <View style={[styles.emojiWrap, { backgroundColor: `${tint}22`, borderColor: `${tint}55` }]}>
                    <Text style={styles.emoji}>{MOOD_EMOJI[entry.mood] ?? '✨'}</Text>
                  </View>
                  <View style={styles.copy}>
                    <Text style={[styles.moodLabel, { color: colors.text }]}>
                      {MOOD_LABELS[entry.mood] ?? entry.mood}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      {entry.displayName} · {entry.timeLabel}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ))}

      {hasNextPage ? (
        <Pressable
          onPress={onLoadMore}
          disabled={isFetchingNextPage}
          style={[styles.loadMore, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          {isFetchingNextPage ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={[styles.loadMoreText, { color: colors.accent }]}>Load older moods</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 18 },
  section: { gap: 10 },
  sectionLabel: { fontSize: 18, fontWeight: '800', letterSpacing: -0.2 },
  sectionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emojiWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22 },
  copy: { flex: 1, gap: 2 },
  moodLabel: { fontSize: 15, fontWeight: '700' },
  meta: { fontSize: 13, fontWeight: '600' },
  emptyWrap: { paddingVertical: 48, paddingHorizontal: 12 },
  emptyText: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  loadMore: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  loadMoreText: { fontSize: 15, fontWeight: '800' },
});
