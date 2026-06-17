import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderHandlers } from 'react-native';
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

interface Props {
  elapsedSec: number;
  willCancel: boolean;
  panHandlers?: GestureResponderHandlers;
  onCancel: () => void;
}

function formatElapsed(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function WaveBar({
  delayMs,
  active,
  color,
  width = 4,
  maxHeight = 100,
}: {
  delayMs: number;
  active: boolean;
  color: string;
  width?: number;
  maxHeight?: number;
}) {
  const height = useSharedValue(10);

  useEffect(() => {
    if (!active) {
      height.value = withTiming(10, { duration: 150 });
      return;
    }
    const timeout = setTimeout(() => {
      height.value = withRepeat(
        withSequence(
          withTiming(maxHeight, { duration: 300, easing: Easing.inOut(Easing.sin) }),
          withTiming(12, { duration: 300, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        true,
      );
    }, delayMs);
    return () => clearTimeout(timeout);
  }, [active, delayMs, height, maxHeight]);

  const style = useAnimatedStyle(() => ({
    height: height.value,
  }));

  return (
    <Animated.View
      style={[styles.waveBar, { backgroundColor: color, width, borderRadius: width / 2 }, style]}
    />
  );
}

/** Occupies the full chat message area while recording. */
export function ChatVoiceRecorder({ elapsedSec, willCancel, panHandlers, onCancel }: Props) {
  const { colors } = useTheme();
  const accent = willCancel ? colors.error : colors.accent;
  const hint = willCancel ? 'Release to cancel' : 'Slide left to cancel';

  return (
    <View
      style={[styles.root, { backgroundColor: colors.background }]}
      {...panHandlers}>
      <View style={styles.main}>
        <View style={[styles.micRing, { borderColor: `${accent}55`, backgroundColor: `${accent}10` }]}>
          <View style={[styles.micCore, { backgroundColor: accent }]}>
            <Icon name="mic" size={44} color={colors.onAccent} filled />
          </View>
        </View>

        <View style={styles.waveRow}>
          {Array.from({ length: 24 }, (_, i) => (
            <WaveBar key={i} delayMs={i * 40} active color={accent} />
          ))}
        </View>

        <View style={[styles.timerPill, { backgroundColor: `${accent}14` }]}>
          <View style={[styles.liveDot, { backgroundColor: accent }]} />
          <Text style={[styles.timer, { color: accent }]}>{formatElapsed(elapsedSec)}</Text>
        </View>

        <Text style={[styles.hint, { color: willCancel ? colors.error : colors.textSecondary }]}>
          {hint}
        </Text>
        <Text style={[styles.subHint, { color: colors.textTertiary }]}>
          Release mic button to send
        </Text>
      </View>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Pressable
          onPress={onCancel}
          style={[
            styles.cancelBtn,
            {
              backgroundColor: willCancel ? `${colors.error}18` : colors.surface,
              borderColor: willCancel ? colors.error : colors.border,
            },
          ]}
          accessibilityLabel="Cancel recording">
          <Icon name="trash" size={20} color={willCancel ? colors.error : colors.textSecondary} />
          <Text style={[styles.cancelLabel, { color: willCancel ? colors.error : colors.text }]}>
            Cancel
          </Text>
        </Pressable>

        <View style={[styles.slideHint, { backgroundColor: colors.surface }]}>
          <Icon name="chevronLeft" size={18} color={willCancel ? colors.error : colors.textTertiary} />
          <Text style={[styles.slideHintText, { color: willCancel ? colors.error : colors.textTertiary }]}>
            Slide left
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 28,
  },
  micRing: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  micCore: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 104,
    width: '100%',
    paddingHorizontal: 8,
  },
  waveBar: {
    minHeight: 10,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  timer: {
    fontSize: 36,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  hint: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  subHint: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: -16,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cancelLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  slideHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 20,
  },
  slideHintText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
