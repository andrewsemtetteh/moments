import { StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function FeatureCard({
  icon,
  tint = 'accent',
  title,
  body,
  children,
}: {
  icon: IconName;
  tint?: Extract<ThemeColor, 'accent' | 'accentSecondary' | 'spark'>;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  const theme = useTheme();

  return (
    <ThemedView type="backgroundElement" elevated style={styles.card}>
      <View style={[styles.iconBadge, { backgroundColor: `${theme[tint]}1F` }]}>
        <Icon name={icon} size={22} color={theme[tint]} />
      </View>
      <ThemedText type="smallBold" style={styles.title}>
        {title}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.body}>
        {body}
      </ThemedText>
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexBasis: 260,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  iconBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.one,
  },
  title: {
    fontSize: 17,
  },
  body: {
    lineHeight: 21,
  },
});
