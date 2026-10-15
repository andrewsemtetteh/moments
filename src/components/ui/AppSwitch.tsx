import { Platform, StyleSheet, Switch, View, type SwitchProps } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

/**
 * The app's on/off switch. Off has to read clearly as a switch too: a solid
 * mid-grey track (not the faint border colour, which vanished on cards), with
 * a thin outline on light themes so the white thumb never blends in.
 */
export function AppSwitch(props: Omit<SwitchProps, 'trackColor' | 'thumbColor' | 'ios_backgroundColor'>) {
  const { colors } = useTheme();
  const off = colors.isDark ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0.24)';
  // A white accent (Dark) would put the white thumb on a white track: use the iOS green instead.
  const on = isNearWhite(colors.accent) ? IOS_GREEN : colors.accent;
  const switchEl = (
    <Switch
      {...props}
      trackColor={{ false: off, true: on }}
      // iOS paints the off track from this, not trackColor.false.
      ios_backgroundColor={off}
      thumbColor="#FFFFFF"
    />
  );
  if (colors.isDark || Platform.OS !== 'ios' || props.value) return switchEl;
  // Light theme, off, iOS: a hairline ring around the track.
  return <View style={styles.ring}>{switchEl}</View>;
}

const IOS_GREEN = '#34C759';

function isNearWhite(color: string) {
  const h = color.replace('#', '');
  if (h.length !== 6) return false;
  return [0, 2, 4].every((i) => parseInt(h.slice(i, i + 2), 16) > 220);
}

const styles = StyleSheet.create({
  ring: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(0,0,0,0.25)' },
});
