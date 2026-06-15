import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { useTheme } from '@/hooks/useTheme';

type Props = {
  prompt: string;
  linkLabel: string;
  href: Href;
};

export function AuthFooter({ prompt, linkLabel, href }: Props) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <View style={styles.footer}>
      <Text style={[styles.prompt, { color: colors.textSecondary }]}>{prompt}</Text>
      <Pressable
        onPress={() => router.push(href)}
        hitSlop={8}
        accessibilityRole="link"
        accessibilityLabel={linkLabel}>
        <Text style={[styles.link, { color: colors.accent }]}>{linkLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 32,
    paddingTop: 8,
  },
  prompt: {
    fontSize: 15,
    lineHeight: 22,
  },
  link: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
});
