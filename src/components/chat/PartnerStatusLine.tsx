import { StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { formatPartnerStatus, partnerStatusColor } from '@/lib/partner-status';

interface Props {
  isTyping: boolean;
  isOnline: boolean;
  lastSeenAt: string | null;
  /** Online status hidden (you and/or partner turned sharing off). */
  statusHidden?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  showDot?: boolean;
}

export function PartnerStatusLine({
  isTyping,
  isOnline,
  lastSeenAt,
  statusHidden = false,
  style,
  textStyle,
  showDot = true,
}: Props) {
  const { colors } = useTheme();
  const status = formatPartnerStatus(isTyping, isOnline, lastSeenAt, statusHidden);
  const color = partnerStatusColor(status.variant, colors);

  return (
    <View style={[styles.row, style]}>
      {showDot && <View style={[styles.dot, { backgroundColor: color }]} />}
      <Text style={[styles.text, { color }, textStyle]} numberOfLines={1}>
        {status.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, minWidth: 0 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '500', flexShrink: 1 },
});
