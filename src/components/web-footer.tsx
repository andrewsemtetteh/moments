import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Site footer — just the copyright notice, pinned to the very bottom of the page. */
export function WebFooter() {
  const theme = useTheme();

  return (
    <View style={[styles.footer, { borderTopColor: theme.border }]}>
      <ThemedText type="small" themeColor="textTertiary" style={styles.line}>
        © {new Date().getFullYear()} Avolo Studios. All rights reserved.
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    width: '100%',
    marginTop: Spacing.four,
    paddingVertical: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  line: {
    textAlign: 'center',
  },
});
