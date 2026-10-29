import { Pressable, StyleSheet, Text } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { colorWithAlpha } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';

/**
 * The one Nudge button, as on the daily question: a soft pill in the colour, "Nudge" with a paper
 * plane (it's sent to them), then "Nudged" with a tick once it's gone.
 */
export function NudgeButton({
  name,
  nudged = false,
  busy = false,
  onPress,
  accent,
}: {
  /** Who's nudged (for screen readers). */
  name: string;
  nudged?: boolean;
  busy?: boolean;
  onPress: () => void;
  /** The page's colour (a Play area's); the theme's accent otherwise. */
  accent?: string;
}) {
  const { colors } = useTheme();
  const tint = accent ?? colors.accent;
  const bg = accent ? colorWithAlpha(accent, 0.14) : colors.accentSoft;
  return (
    <Pressable
      onPress={onPress}
      disabled={nudged || busy}
      accessibilityRole="button"
      accessibilityLabel={nudged ? `${name} was nudged` : `Nudge ${name}`}
      hitSlop={6}
      style={({ pressed }) => [styles.pill, { backgroundColor: bg, opacity: busy ? 0.6 : pressed ? 0.8 : 1 }]}>
      <Text style={[styles.text, { color: tint }]}>{nudged ? 'Nudged' : 'Nudge'}</Text>
      <Icon name={nudged ? 'check' : 'paperPlane'} size={14} color={tint} filled />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    flexShrink: 0,
  },
  text: { fontSize: 13, fontWeight: '800' },
});
