import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';

import { useTheme } from '@/hooks/useTheme';

type Props = {
  prompt: string;
  linkLabel: string;
  href?: Href;
  onPress?: () => void;
};

/** Prompt text + tappable link only on the label (not the whole row). */
export function PromptLink({ prompt, linkLabel, href, onPress }: Props) {
  const router = useRouter();
  const { colors } = useTheme();

  const handlePress = () => {
    if (onPress) onPress();
    else if (href) router.push(href);
  };

  return (
    <View style={styles.row}>
      <Text style={[styles.prompt, { color: colors.textSecondary }]}>{prompt}</Text>
      <Pressable onPress={handlePress} hitSlop={8} accessibilityRole="link" accessibilityLabel={linkLabel}>
        <Text style={[styles.link, { color: colors.accent }]}>{linkLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 20,
  },
  prompt: { fontSize: 15, lineHeight: 22 },
  link: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
});
