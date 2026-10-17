import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { separatorColor } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { AppSwitch } from '@/components/ui/AppSwitch';

/**
 * An on/off setting, laid out like the Privacy toggles: icon tile, title with a
 * short line under it saying what it does, and the switch on the right.
 */
export function SettingsToggleRow({
  icon,
  title,
  subtitle,
  value,
  onChange,
  disabled,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <View style={styles.left}>
        <View style={[styles.iconWrap, { backgroundColor: colors.boldBorder ? colors.backgroundElevated : colors.surfaceElevated }]}>
          <Icon name={icon} size={20} color={colors.text} />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <AppSwitch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={title}
      />
    </View>
  );
}

/** Hairline between toggle rows, starting under the text like iOS Settings. */
export function SettingsToggleDivider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: separatorColor(colors) }]} />;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  disabled: { opacity: 0.5 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 },
  iconWrap: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  sub: { fontSize: 13, marginTop: 2, lineHeight: 17 },
  divider: { height: 1, marginLeft: 60 },
});
