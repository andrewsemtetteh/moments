import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { EVENT_TYPE_META, getEventTypeColors } from '@/constants/calendar-events';
import { useLiveCountdown } from '@/hooks/useLiveCountdown';
import { useTheme } from '@/hooks/useTheme';
import { eventProgress } from '@/lib/event-countdown';
import type { CalendarEvent } from '@/types/database';

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function CountdownUnit({
  value,
  label,
  accent,
  text,
  soft,
}: {
  value: string;
  label: string;
  accent: string;
  text: string;
  soft: string;
}) {
  return (
    <View style={styles.unit}>
      <View style={[styles.unitBox, { backgroundColor: soft, borderColor: accent }]}>
        <Text style={[styles.unitValue, { color: text }]}>{value}</Text>
      </View>
      <Text style={[styles.unitLabel, { color: accent }]}>{label}</Text>
    </View>
  );
}

export function PlanCountdownHero({ event }: { event: CalendarEvent }) {
  const { colors } = useTheme();
  const meta = EVENT_TYPE_META[event.type];
  const tc = getEventTypeColors(event.type, colors);
  const at = new Date(event.date_time);
  const cd = useLiveCountdown(at);
  const progress = eventProgress(event.created_at, at);

  if (!cd || cd.isPast) return null;

  const gradient: [string, string] = [tc.main, colors.isDark ? colors.backgroundElevated : colors.surface];

  return (
    <View style={styles.wrap}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradient}>
        <View style={styles.topRow}>
          <View style={[styles.typePill, { backgroundColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.typeEmoji}>{meta.emoji}</Text>
            <Text style={styles.typeLabel}>{meta.label}</Text>
          </View>
          <Text style={styles.untilLabel}>COUNTDOWN</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {event.title}
        </Text>

        <View style={styles.countdownRow}>
          {cd.days > 0 && (
            <>
              <CountdownUnit value={pad(cd.days)} label="days" accent="#FFFFFF" text="#FFFFFF" soft="rgba(255,255,255,0.18)" />
              <Text style={styles.sep}>:</Text>
            </>
          )}
          <CountdownUnit value={pad(cd.hours)} label="hrs" accent="#FFFFFF" text="#FFFFFF" soft="rgba(255,255,255,0.18)" />
          <Text style={styles.sep}>:</Text>
          <CountdownUnit value={pad(cd.minutes)} label="min" accent="#FFFFFF" text="#FFFFFF" soft="rgba(255,255,255,0.18)" />
          {cd.showSeconds && (
            <>
              <Text style={styles.sep}>:</Text>
              <CountdownUnit value={pad(cd.seconds)} label="sec" accent="#FFFFFF" text="#FFFFFF" soft="rgba(255,255,255,0.18)" />
            </>
          )}
        </View>

        <Text style={styles.when}>{format(at, 'EEEE, MMM d · h:mm a')}</Text>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
        </View>
        <Text style={styles.progressHint}>
          {progress < 0.15 ? 'Just added — the wait begins' : progress > 0.85 ? 'Almost time!' : `${Math.round((1 - progress) * 100)}% of the wait left`}
        </Text>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 20, overflow: 'hidden' },
  gradient: { padding: 20, gap: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  typePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  typeEmoji: { fontSize: 14 },
  typeLabel: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  untilLabel: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', lineHeight: 28 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginVertical: 4 },
  unit: { alignItems: 'center', gap: 4 },
  unitBox: {
    minWidth: 52,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  unitValue: { fontSize: 26, fontWeight: '900', fontVariant: ['tabular-nums'] },
  unitLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  sep: { color: 'rgba(255,255,255,0.6)', fontSize: 22, fontWeight: '300', marginBottom: 16 },
  when: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FFFFFF', borderRadius: 2 },
  progressHint: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', textAlign: 'center' },
});
