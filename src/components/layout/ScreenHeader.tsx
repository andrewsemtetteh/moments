import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HEADER_BUTTON_SIZE, HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { useTheme } from '@/hooks/useTheme';

/**
 * The single header used by every titled full screen (You, Plan,
 * Notifications, Settings, legal pages), laid out the standard iOS way:
 * - Pushed screens (`onBack`): back chevron on the left, title centered.
 * - Plan (`onClose`): it slides in from the left, so it mirrors that — close
 *   chevron on the right, title centered.
 * - Tab roots (neither): large title on the left, optional `right` icon.
 */
export function ScreenHeader({
  title,
  onBack,
  onClose,
  right,
  tint,
}: {
  title: string;
  /** The header sits on a coloured band: the title takes this colour, buttons become light chips. */
  tint?: string;
  /** Back chevron on the left (screens that slide in from the right). */
  onBack?: () => void;
  /** Close chevron on the right (screens that slide in from the left). */
  onClose?: () => void;
  /** Icon on the right (tab roots, or pushed screens with an action). */
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  if (!onBack && !onClose) {
    return (
      <View style={[styles.row, { paddingTop: insets.top + 6 }]}>
        <View style={styles.largeText}>
          <Text
            style={[styles.largeTitle, colors.sticker && styles.stickerTitle, { color: colors.text }]}
            numberOfLines={1}
            accessibilityRole="header">
            {title}
          </Text>
        </View>
        {right ? <View style={styles.rightEdge}>{right}</View> : null}
      </View>
    );
  }

  return (
    <View style={[styles.row, { paddingTop: insets.top + 6 }]}>
      <View style={[styles.slot, styles.leftEdge]}>
        {onBack ? (
          <HeaderIconButton icon="chevronLeft" onPress={onBack} accessibilityLabel="Go back" chip={!!tint} />
        ) : null}
      </View>
      <View style={styles.centerText}>
        <Text
          style={[styles.title, colors.sticker && styles.stickerTitle, { color: tint ?? colors.text }]}
          numberOfLines={1}
          accessibilityRole="header">
          {title}
        </Text>
      </View>
      <View style={[styles.slot, styles.rightEdge]}>
        {onClose ? (
          <HeaderIconButton icon="chevronRight" onPress={onClose} accessibilityLabel="Close" chip={!!tint} />
        ) : (
          right
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingBottom: 10,
    minHeight: HEADER_BUTTON_SIZE,
  },
  // Equal-width side slots keep the title truly centered on the screen.
  slot: { width: HEADER_BUTTON_SIZE, height: HEADER_BUTTON_SIZE },
  // The 44pt tap area is wider than the 28pt icon; pull it in so the icon's
  // visible edge lines up with the 20pt page margin.
  leftEdge: { marginLeft: -10 },
  rightEdge: { marginRight: -10 },
  centerText: { flex: 1, minWidth: 0, alignItems: 'center' },
  // Same size as the tab-root title ("You") so every page title matches.
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  largeText: { flex: 1, minWidth: 0 },
  largeTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  // Default: the onboarding heading weight.
  stickerTitle: { fontWeight: '900', letterSpacing: -0.6 },
});
