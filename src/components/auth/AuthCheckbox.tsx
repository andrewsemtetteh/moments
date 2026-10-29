import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '@/hooks/useTheme';
import { outlineColor } from '@/components/ui/primitives';

type Props = {
  checked: boolean;
  onToggle: () => void;
  label?: string;
  hitSlop?: number;
};

export function AuthCheckbox({ checked, onToggle, label, hitSlop = 4 }: Props) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const boxStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.set(
      withSequence(withTiming(0.86, { duration: 80 }), withSpring(1, { damping: 14, stiffness: 320 })),
    );
    onToggle();
  };

  const checkbox = (
    <Animated.View
      style={[
        styles.checkbox,
        boxStyle,
        { borderColor: outlineColor(colors), backgroundColor: colors.surface },
        checked && { backgroundColor: colors.accent, borderColor: colors.accent },
      ]}>
      {checked && <Text style={[styles.checkmark, { color: colors.onAccent }]}>✓</Text>}
    </Animated.View>
  );

  if (!label) {
    return (
      <Pressable
        onPress={handlePress}
        hitSlop={hitSlop}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}>
        {checkbox}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={styles.row}
      hitSlop={hitSlop}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}>
      {checkbox}
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { fontSize: 14, fontWeight: '700' },
  label: { fontSize: 15 },
});
