import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import {
  formatAnniversaryDisplay,
  formatTogetherLabel,
  getAnniversaryCountdown,
} from '@/lib/anniversary';
import { useTheme } from '@/hooks/useTheme';

interface AnniversaryCountdownMilestoneProps {
  anniversaryIso: string;
  onEdit?: () => void;
}

export function AnniversaryCountdownMilestone({ anniversaryIso, onEdit }: AnniversaryCountdownMilestoneProps) {
  const { colors } = useTheme();
  const { daysUntil, togetherDays, anniversaryDate, togetherSince } = getAnniversaryCountdown(anniversaryIso);
  const isToday = daysUntil === 0;
  const yearProgress = Math.min(1, Math.max(0, 1 - daysUntil / 365));

  return (
    <View style={styles.stack}>
      <LinearGradient
        colors={colors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.countdownCard}>
        <View style={styles.countdownTop}>
          <Text style={styles.countdownEyebrow}>{isToday ? 'Happy anniversary' : 'Next anniversary in'}</Text>
          {onEdit ? (
            <Pressable
              onPress={onEdit}
              hitSlop={10}
              style={styles.editChip}
              accessibilityRole="button"
              accessibilityLabel="Edit anniversary date">
              <Icon name="edit" size={14} color="#fff" />
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.countdownNumber}>{isToday ? '🎉' : daysUntil}</Text>
        {!isToday ? <Text style={styles.countdownUnit}>days</Text> : null}
        <Text style={styles.countdownDate}>{format(anniversaryDate, 'EEEE · MMMM d, yyyy')}</Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${yearProgress * 100}%` }]} />
        </View>
        <Text style={styles.progressHint}>
          {isToday ? 'Celebrate today together' : `${Math.round(yearProgress * 100)}% through your year together`}
        </Text>
      </LinearGradient>

      <Pressable
        onPress={onEdit}
        disabled={!onEdit}
        style={[styles.togetherCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <View style={[styles.togetherIcon, { backgroundColor: colors.accentSoft }]}>
          <Text style={styles.togetherEmoji}>💕</Text>
        </View>
        <View style={styles.togetherCopy}>
          <Text style={[styles.togetherLabel, { color: colors.textSecondary }]}>Together since</Text>
          <Text style={[styles.togetherDate, { color: colors.text }]}>{formatAnniversaryDisplay(togetherSince)}</Text>
          <Text style={[styles.togetherMeta, { color: colors.accent }]}>
            {formatTogetherLabel(togetherSince, togetherDays)}
          </Text>
        </View>
        {onEdit ? <Icon name="chevronRight" size={18} color={colors.textTertiary} /> : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 12 },
  countdownCard: {
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
    alignItems: 'center',
    gap: 2,
    minHeight: 168,
  },
  countdownTop: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  countdownEyebrow: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  editChip: {
    position: 'absolute',
    right: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    color: '#fff',
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 60,
    letterSpacing: -1,
    textAlign: 'center',
  },
  countdownUnit: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    fontWeight: '700',
    marginTop: -2,
    marginBottom: 4,
  },
  countdownDate: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
    fontWeight: '600',
  },
  progressTrack: {
    width: '100%',
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  progressHint: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  togetherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  togetherIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  togetherEmoji: { fontSize: 22 },
  togetherCopy: { flex: 1, gap: 2 },
  togetherLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  togetherDate: { fontSize: 16, fontWeight: '800' },
  togetherMeta: { fontSize: 13, fontWeight: '700', marginTop: 2 },
});
