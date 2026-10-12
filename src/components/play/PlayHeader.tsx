import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { closeStackScreen } from '@/lib/router';

/** Back button + title for Play's pushed screens. `onColor` = drawn over a tone-coloured hero. */
export function PlayHeader({
  title,
  subtitle,
  right,
  onColor,
}: {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  onColor?: string;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const fg = onColor ?? colors.text;

  return (
    <View style={[styles.row, { paddingTop: insets.top + 6 }]}>
      <Pressable
        onPress={() => closeStackScreen(router)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back"
        style={styles.back}>
        <Icon name="chevronLeft" size={26} color={fg} />
      </Pressable>
      <View style={styles.titles}>
        {title ? (
          <Text style={[styles.title, { color: fg }]} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={[styles.subtitle, { color: onColor ? fg : colors.accent }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingBottom: 6, gap: 4 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  titles: { flex: 1, gap: 1, alignItems: 'center' },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3, textAlign: 'center' },
  subtitle: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  // Same width as the back button so the title sits in the true centre.
  right: { width: 44, alignItems: 'center', justifyContent: 'center' },
});
