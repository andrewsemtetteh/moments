import { Image } from 'expo-image';
import { mediaSource } from '@/lib/storage-cdn';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Icon, type IconName } from '@/components/ui/Icon';
import { formatCallDuration } from '@/lib/call-format';
import { useCallStore } from '@/stores';

/** Call colours: always dark, like FaceTime and WhatsApp, whatever the app's theme. */
export const CALL = {
  bg: '#0E0D12',
  text: '#FFFFFF',
  soft: 'rgba(255,255,255,0.72)',
  button: 'rgba(255,255,255,0.16)',
  buttonOn: '#FFFFFF',
  red: '#FF3B30',
  green: '#34C759',
  panel: 'rgba(18,18,24,0.62)',
} as const;

/** Ticks every second while a call is connected. */
export function useCallTimer(): string | null {
  const connectedAt = useCallStore((s) => s.connectedAt);
  const phase = useCallStore((s) => s.phase);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (phase !== 'active') return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [phase]);
  return phase === 'active' && connectedAt ? formatCallDuration(now - connectedAt) : null;
}

/**
 * Behind the call: their photo, blurred and darkened (as FaceTime does for voice calls and
 * a camera that's off), or a deep gradient when there's no photo.
 */
export function CallBackdrop({ photo, tint }: { photo?: string | null; tint: string }) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {photo ? (
        <Image source={mediaSource(photo)} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={48} />
      ) : (
        <LinearGradient colors={[tint, CALL.bg]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
      )}
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0.25)', 'rgba(0,0,0,0.7)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

/** Soft rings spreading out from the photo while it rings or connects. */
export function PulseRings({ size, active }: { size: number; active: boolean }) {
  const reduce = useReducedMotion();
  return active && !reduce ? (
    <>
      <Ring size={size} delay={0} />
      <Ring size={size} delay={900} />
    </>
  ) : null;
}

function Ring({ size, delay }: { size: number; delay: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1, false));
    // Runs once per ring.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: 0.45 * (1 - t.value), transform: [{ scale: 1 + t.value * 0.55 }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }, style]}
    />
  );
}

/** A round call button with its label underneath (Mute, Camera, Speaker, End). */
export function CallButton({
  icon,
  label,
  onPress,
  on = false,
  danger = false,
  accept = false,
  size = 62,
  rotate,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Switched on (muted, speaker): a white button with a dark icon, as on iPhone. */
  on?: boolean;
  danger?: boolean;
  accept?: boolean;
  size?: number;
  rotate?: string;
}) {
  const bg = danger ? CALL.red : accept ? CALL.green : on ? CALL.buttonOn : CALL.button;
  const fg = on && !danger && !accept ? '#111111' : '#FFFFFF';
  return (
    <View style={styles.buttonWrap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: on }}
        style={({ pressed }) => [
          styles.button,
          { width: size, height: size, borderRadius: size / 2, backgroundColor: bg },
          pressed && styles.pressed,
        ]}>
        <View style={rotate ? { transform: [{ rotate }] } : undefined}>
          <Icon name={icon} size={Math.round(size * 0.42)} color={fg} filled />
        </View>
      </Pressable>
      <Text style={styles.buttonLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** A small round glass button for the top corners (minimise, flip camera). */
export function CallChip({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}>
      <Icon name={icon} size={22} color="#FFFFFF" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', borderWidth: 2, borderColor: '#FFFFFF' },
  buttonWrap: { alignItems: 'center', gap: 7, minWidth: 56 },
  button: { alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { color: CALL.soft, fontSize: 12, fontWeight: '600' },
  chip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.96 }] },
});
