import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
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
  );
}

const styles = StyleSheet.create({
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
});
