import { format } from 'date-fns';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { Radius, Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { getAnniversaryCountdown } from '@/lib/anniversary';

interface AnniversaryCountdownMilestoneProps {
  anniversaryIso: string;
  onEdit?: () => void;
}

export function AnniversaryCountdownMilestone({ anniversaryIso, onEdit }: AnniversaryCountdownMilestoneProps) {
  const { colors } = useTheme();
  const { daysUntil, anniversaryDate } = getAnniversaryCountdown(anniversaryIso);
  const isToday = daysUntil === 0;
  const yearProgress = Math.min(1, Math.max(0, 1 - daysUntil / 365));

  return (
    <View
      style={[
        styles.countdownCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}>
      <View style={styles.countdownTop}>
        <Text style={[styles.countdownEyebrow, { color: colors.textSecondary }]}>
          {isToday ? 'Happy anniversary' : 'Next anniversary in'}
        </Text>
        {onEdit ? (
          <Pressable
            onPress={onEdit}
            hitSlop={10}
            style={[styles.editChip, { backgroundColor: colors.accentSoft }]}
            accessibilityRole="button"
            accessibilityLabel="Edit anniversary date">
            <Icon name="edit" size={14} color={colors.accent} />
          </Pressable>
        ) : null}
      </View>

      <Text style={[styles.countdownNumber, { color: colors.text }]}>{isToday ? '🎉' : daysUntil}</Text>
      {!isToday ? (
        <Text style={[styles.countdownUnit, { color: colors.textSecondary }]}>days</Text>
      ) : null}
      <Text style={[styles.countdownDate, { color: colors.text }]}>
        {format(anniversaryDate, 'EEEE · MMMM d, yyyy')}
      </Text>

      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${yearProgress * 100}%`, backgroundColor: colors.accent }]} />
      </View>
      <Text style={[styles.progressHint, { color: colors.textTertiary }]}>
        {isToday ? 'Celebrate today together' : `${Math.round(yearProgress * 100)}% through your year together`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  countdownCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    alignItems: 'center',
    gap: 2,
  },
  countdownTop: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  countdownEyebrow: {
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNumber: {
    fontSize: 56,
    fontWeight: '800',
    lineHeight: 60,
    letterSpacing: -1,
    textAlign: 'center',
  },
  countdownUnit: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: -2,
    marginBottom: 4,
  },
  countdownDate: {
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
    marginTop: 16,
    overflow: 'hidden',
  },
  progressFill: {
    height: 5,
    borderRadius: 3,
  },
  progressHint: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
});
