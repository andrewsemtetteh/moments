import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { momentChrome } from '@/lib/moment-theme';

interface HistoryActionDockProps {
  bottomInset: number;
  selectionCount: number;
  deletableCount: number;
  downloading: boolean;
  deleting: boolean;
  onDelete: () => void;
  onDownload: () => void;
  onRecap: () => void;
}

export function HistoryActionDock({
  bottomInset,
  selectionCount,
  deletableCount,
  downloading,
  deleting,
  onDelete,
  onDownload,
  onRecap,
}: HistoryActionDockProps) {
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const disabled = selectionCount === 0 || downloading || deleting;

  return (
    <View style={[styles.wrap, { paddingBottom: bottomInset + 12 }]}>
      <View
        style={[
          styles.dock,
          { backgroundColor: chrome.elevated, borderColor: chrome.border },
        ]}>
        <DockAction
          icon="trash"
          label="Delete"
          tone="danger"
          chrome={chrome}
          disabled={disabled || deletableCount === 0}
          loading={deleting}
          onPress={onDelete}
        />
        <View style={[styles.divider, { backgroundColor: chrome.border }]} />
        <DockAction
          icon="download"
          label="Download"
          tone="neutral"
          chrome={chrome}
          disabled={disabled}
          loading={downloading}
          onPress={onDownload}
        />
        <View style={[styles.divider, { backgroundColor: chrome.border }]} />
        <DockAction
          icon="plus"
          label="Recap"
          tone="neutral"
          chrome={chrome}
          disabled={disabled}
          recapIcon
          onPress={onRecap}
        />
      </View>
    </View>
  );
}

function DockAction({
  icon,
  label,
  tone,
  chrome,
  disabled,
  loading,
  iconFilled,
  recapIcon,
  onPress,
}: {
  icon: IconName;
  label: string;
  tone: 'danger' | 'neutral' | 'primary';
  chrome: ReturnType<typeof momentChrome>;
  disabled?: boolean;
  loading?: boolean;
  iconFilled?: boolean;
  recapIcon?: boolean;
  onPress: () => void;
}) {
  const iconColor =
    tone === 'primary'
      ? chrome.onAccent
      : tone === 'danger'
        ? disabled
          ? `${chrome.error}59`
          : chrome.error
        : disabled
          ? chrome.textTertiary
          : chrome.text;
  const labelColor =
    tone === 'danger' && !disabled
      ? chrome.error
      : disabled
        ? chrome.textTertiary
        : chrome.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.action,
        disabled && styles.actionDisabled,
        pressed && !disabled && styles.actionPressed,
      ]}>
      <View
        style={[
          styles.iconBubble,
          { backgroundColor: chrome.surfaceSoft },
          tone === 'danger' && !disabled && { backgroundColor: `${chrome.error}24` },
          tone === 'primary' && { backgroundColor: chrome.accent },
          recapIcon && {
            borderWidth: 2,
            borderColor: chrome.text,
            backgroundColor: 'transparent',
          },
        ]}>
        {loading ? (
          <ActivityIndicator color={iconColor} size="small" />
        ) : (
          <Icon name={icon} size={recapIcon ? 16 : 20} color={iconColor} filled={iconFilled} />
        )}
      </View>
      <Text style={[styles.label, { color: labelColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 6,
  },
  action: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    borderRadius: 14,
    minWidth: 0,
  },
  actionDisabled: { opacity: 0.42 },
  actionPressed: { opacity: 0.78, transform: [{ scale: 0.97 }] },
  iconBubble: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  divider: {
    width: StyleSheet.hairlineWidth,
    marginVertical: 10,
  },
});
