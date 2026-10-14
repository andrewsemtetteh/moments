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
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  disabled?: boolean;
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
      style={({ pressed }) => [styles.button, { opacity: disabled ? 0.4 : pressed ? 0.5 : 1 }]}>
      <Icon name={icon} size={HEADER_ICON_SIZE} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: HEADER_BUTTON_SIZE,
    height: HEADER_BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
