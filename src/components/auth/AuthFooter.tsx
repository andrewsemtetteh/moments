import * as Haptics from 'expo-haptics';
import { useRouter, type Href } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { authLinkColors, authLinkStyles } from '@/components/auth/auth-link-styles';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  prompt: string;
  linkLabel: string;
  href: Href;
  onBeforeNavigate?: () => void | Promise<void>;
};

export function AuthFooter({ prompt, linkLabel, href, onBeforeNavigate }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const linkColors = authLinkColors(colors);

  const handlePress = async () => {
    void Haptics.selectionAsync();
    await onBeforeNavigate?.();
    router.push(href);
  };

  return (
    <Pressable onPress={handlePress} hitSlop={10} style={authLinkStyles.footerRow} accessibilityRole="link">
      <Text style={[authLinkStyles.footerText, { color: linkColors.muted }]}>
        {prompt} <Text style={[authLinkStyles.footerLink, { color: linkColors.emphasis }]}>{linkLabel}</Text>
      </Text>
    </Pressable>
  );
}
