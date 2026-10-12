import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

const BAR_COUNT = 34;
const REC_RED = '#FF3B30';

interface Props {
  elapsedSec: number;
  /** Live input level in dB from the recorder (-160…0), if metering is on. */
  metering?: number;
  /** True while the mic is being held (walkie-talkie mode): release sends. */
  holding: boolean;
  onCancel: () => void;
  onSend: () => void;
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** dB → 0.12…1 bar height. */
function level(db: number | undefined) {
  if (db == null || !Number.isFinite(db)) return 0.12;
  return Math.min(1, Math.max(0.12, (db + 55) / 50));
}

/**
 * The composer while a voice note records. It replaces the text row so the
 * chat stays in view: delete on the left, a live waveform with the timer in the
 * middle, and a big Send on the right. While the mic is held it just says
 * "Release to send".
 */
export function ChatVoiceRecorder({ elapsedSec, metering, holding, onCancel, onSend }: Props) {
  const { colors } = useTheme();
  const [levels, setLevels] = useState<number[]>(() => Array.from({ length: BAR_COUNT }, () => 0.12));

  useEffect(() => {
    setLevels((prev) => [...prev.slice(1), level(metering)]);
  }, [metering, elapsedSec]);

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(0.25, { duration: 600, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [pulse]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  return (
    <View style={styles.row}>
      {holding ? null : (
        <Pressable
          onPress={onCancel}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Delete recording"
          style={({ pressed }) => [styles.sideBtn, pressed && styles.pressed]}>
          <Icon name="trash" size={24} color={colors.error} />
        </Pressable>
      )}

      <View
        style={[
          styles.pill,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
          },
        ]}>
        <Animated.View style={[styles.dot, dotStyle]} />
        <Text style={[styles.timer, { color: colors.text }]}>{formatElapsed(elapsedSec)}</Text>
        <View style={styles.wave}>
          {levels.map((l, i) => (
            <View
              key={i}
              style={[styles.bar, { height: `${Math.round(l * 100)}%`, backgroundColor: colors.accent }]}
            />
          ))}
        </View>
      </View>

      {/* While held, the chat's own mic button (still under your finger) sits here. */}
      {holding ? null : (
        <Pressable
          onPress={onSend}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Send voice message"
          style={({ pressed }) => [styles.sendBtn, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
          <Icon name="send" size={22} color={colors.onAccent} filled />
        </Pressable>
      )}

      {holding ? (
        <Text style={[styles.holdHint, { color: colors.textSecondary }]} pointerEvents="none">
          Release to send
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10 },
  sideBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  pill: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    gap: 10,
  },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: REC_RED },
  timer: { fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'], minWidth: 40 },
  wave: { flex: 1, height: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bar: { width: 3, borderRadius: 1.5, minHeight: 3 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
  holdHint: { position: 'absolute', top: -22, alignSelf: 'center', left: 0, right: 0, textAlign: 'center', fontSize: 12, fontWeight: '700' },
});
