import * as Haptics from '@/lib/haptics';
import { Pressable, StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

/** Tap area — bigger than the icon itself so a bare icon is still easy to hit. */
export const HEADER_BUTTON_SIZE = 44;
/** Every header icon app-wide (back, close, settings, Plan, bell) uses this size. */
export const HEADER_ICON_SIZE = 28;

/**
 * The app's one header icon button — back, close, settings. A plain, large
 * icon in the text color (no circle or border), with a 44pt tap target.
 */
export function HeaderIconButton({
  icon,
  onPress,
  accessibilityLabel,
  disabled,
  color,
  chip = false,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
  /** Icon colour on a coloured header (defaults to the theme's text). */
  color?: string;
  /** On a coloured band: a light round chip with a dark icon, like the streak page's back. */
  chip?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={({ pressed }) => [
        styles.button,
        chip && styles.chip,
        { opacity: disabled ? 0.4 : pressed ? (chip ? 0.8 : 0.5) : 1 },
      ]}>
      <Icon name={icon} size={chip ? 24 : HEADER_ICON_SIZE} color={chip ? CHIP_INK : (color ?? colors.text)} />
    </Pressable>
  );
}

/** The chip's icon: dark on the light chip, whatever the band. */
const CHIP_INK = '#1A1A1A';

const styles = StyleSheet.create({
  chip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.72)',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  button: {
    width: HEADER_BUTTON_SIZE,
    height: HEADER_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
