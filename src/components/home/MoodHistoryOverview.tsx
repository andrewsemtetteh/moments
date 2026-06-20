import { StyleSheet, Text, View } from 'react-native';

import { MOOD_COLORS, MOOD_EMOJI, MOOD_LABELS, type ThemeColors } from '@/constants/design-system';
import { getFirstName } from '@/lib/avatar-initial';
import { moodEmoji, type MoodCount, type MoodDayBucket, type MoodPartnerWeekRow } from '@/lib/mood-history';

const CHART_HEIGHT = 96;
const WEEKLY_HEIGHT = 88;

interface MoodHistoryOverviewProps {
  colors: ThemeColors;
  dailyActivity: MoodDayBucket[];
  moodCounts: MoodCount[];
  partnerWeekly: MoodPartnerWeekRow[];
  showPartnerComparison: boolean;
  partnerName?: string | null;
  total: number;
  topMood: string | null;
  topMoodCount: number;
}

export function MoodHistoryOverview({
  colors,
  dailyActivity,
  moodCounts,
  partnerWeekly,
  showPartnerComparison,
  partnerName,
  total,
  topMood,
  topMoodCount,
}: MoodHistoryOverviewProps) {
  const partnerLabel = getFirstName(partnerName) ?? 'Partner';
  const maxDayCount = Math.max(1, ...dailyActivity.map((day) => day.count));
  const maxMoodCount = Math.max(1, ...moodCounts.map((item) => item.count));
  const maxPartnerWeek = Math.max(
    1,
    ...partnerWeekly.flatMap((week) => [week.youCount, week.partnerCount]),
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.summaryRow}>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{total}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Moods logged</Text>
        </View>
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.summaryEmoji}>{topMood ? MOOD_EMOJI[topMood] ?? '✨' : '·'}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
            {topMood ? `${MOOD_LABELS[topMood] ?? topMood} · ${topMoodCount}` : 'No top mood yet'}
          </Text>
        </View>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.panelTitle, { color: colors.text }]}>Daily activity</Text>
        <Text style={[styles.panelHint, { color: colors.textSecondary }]}>Last 14 days</Text>
        <View style={styles.chartRow}>
          {dailyActivity.map((day) => {
            const barHeight = day.count > 0 ? Math.max(8, (day.count / maxDayCount) * CHART_HEIGHT) : 4;
            const tint = day.dominantMood ? MOOD_COLORS[day.dominantMood] ?? colors.accent : colors.border;
            return (
              <View key={day.dateKey} style={styles.chartCol}>
                <Text style={styles.chartEmoji}>{day.count > 0 ? moodEmoji(day.dominantMood) : ' '}</Text>
                <View style={[styles.chartTrack, { backgroundColor: colors.surfaceElevated }]}>
                  <View
                    style={[
                      styles.chartBar,
                      {
                        height: barHeight,
                        backgroundColor: day.count > 0 ? tint : colors.border,
                        opacity: day.count > 0 ? 1 : 0.35,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.chartLabel, { color: colors.textTertiary }]} numberOfLines={1}>
                  {day.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {showPartnerComparison && partnerWeekly.length > 0 ? (
        <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.panelTitle, { color: colors.text }]}>Weekly together</Text>
          <Text style={[styles.panelHint, { color: colors.textSecondary }]}>
            Me vs {partnerLabel} · last 8 weeks
          </Text>
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>Me</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.legendText, { color: colors.textSecondary }]}>{partnerLabel}</Text>
            </View>
          </View>
          <View style={styles.weeklyRow}>
            {partnerWeekly.map((week) => (
              <View key={week.weekKey} style={styles.weeklyCol}>
                <View style={styles.weeklyBars}>
                  <View style={[styles.weeklyTrack, { backgroundColor: colors.surfaceElevated }]}>
                    <View
                      style={[
                        styles.weeklyBar,
                        {
                          height: week.youCount > 0 ? Math.max(8, (week.youCount / maxPartnerWeek) * WEEKLY_HEIGHT) : 4,
                          backgroundColor: colors.accent,
                        },
                      ]}
                    />
                  </View>
                  <View style={[styles.weeklyTrack, { backgroundColor: colors.surfaceElevated }]}>
                    <View
                      style={[
                        styles.weeklyBar,
                        {
                          height:
                            week.partnerCount > 0
                              ? Math.max(8, (week.partnerCount / maxPartnerWeek) * WEEKLY_HEIGHT)
                              : 4,
                          backgroundColor: colors.success,
                        },
                      ]}
                    />
                  </View>
                </View>
                <Text style={[styles.chartLabel, { color: colors.textTertiary }]} numberOfLines={1}>
                  {week.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.panelTitle, { color: colors.text }]}>Most common moods</Text>
        {moodCounts.length === 0 ? (
          <Text style={[styles.emptyCopy, { color: colors.textSecondary }]}>
            Log moods on Home to see trends here.
          </Text>
        ) : (
          moodCounts.slice(0, 6).map((item, index) => (
            <View key={item.mood} style={styles.countRow}>
              <Text style={[styles.rank, { color: colors.textTertiary }]}>{index + 1}</Text>
              <Text style={styles.countEmoji}>{MOOD_EMOJI[item.mood] ?? '✨'}</Text>
              <View style={styles.countCopy}>
                <View style={styles.countHeader}>
                  <Text style={[styles.countLabel, { color: colors.text }]}>
                    {MOOD_LABELS[item.mood] ?? item.mood}
                  </Text>
                  <Text style={[styles.countValue, { color: colors.textSecondary }]}>
                    {item.count} · {Math.round(item.share * 100)}%
                  </Text>
                </View>
                <View style={[styles.countTrack, { backgroundColor: colors.surfaceElevated }]}>
                  <View
                    style={[
                      styles.countFill,
                      {
                        width: `${(item.count / maxMoodCount) * 100}%`,
                        backgroundColor: MOOD_COLORS[item.mood] ?? colors.accent,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    gap: 4,
    minHeight: 84,
    justifyContent: 'center',
  },
  summaryValue: { fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  summaryEmoji: { fontSize: 28, lineHeight: 32 },
  summaryLabel: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  panel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
    padding: 16,
    gap: 10,
  },
  panelTitle: { fontSize: 16, fontWeight: '800' },
  panelHint: { fontSize: 13, fontWeight: '600', marginTop: -4 },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 4 },
  chartCol: { flex: 1, alignItems: 'center', gap: 6 },
  chartEmoji: { fontSize: 12, height: 14, lineHeight: 14 },
  chartTrack: {
    width: '100%',
    height: 96,
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartBar: { width: '100%', borderRadius: 8 },
  chartLabel: { fontSize: 10, fontWeight: '700' },
  legendRow: { flexDirection: 'row', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: '700' },
  weeklyRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  weeklyCol: { flex: 1, alignItems: 'center', gap: 6 },
  weeklyBars: { flexDirection: 'row', gap: 3, alignItems: 'flex-end' },
  weeklyTrack: {
    width: 10,
    height: 88,
    borderRadius: 6,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  weeklyBar: { width: '100%', borderRadius: 6 },
  countRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rank: { width: 18, fontSize: 13, fontWeight: '800', textAlign: 'center' },
  countEmoji: { fontSize: 22, width: 28, textAlign: 'center' },
  countCopy: { flex: 1, gap: 6 },
  countHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  countLabel: { fontSize: 15, fontWeight: '700' },
  countValue: { fontSize: 13, fontWeight: '700' },
  countTrack: { height: 8, borderRadius: 999, overflow: 'hidden' },
  countFill: { height: '100%', borderRadius: 999 },
  emptyCopy: { fontSize: 14, lineHeight: 20 },
});
