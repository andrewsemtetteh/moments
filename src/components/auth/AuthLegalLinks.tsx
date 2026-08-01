import { useRouter } from 'expo-router';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { authLinkColors, authLinkStyles } from '@/components/auth/auth-link-styles';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  /** Lead-in copy before the linked legal documents. */
  prefix?: string;
  style?: StyleProp<TextStyle>;
  /** When false, legal copy is left-aligned (e.g. beside a checkbox). */
  centered?: boolean;
};

export function AuthLegalLinks({
  prefix = 'By continuing, you agree to our',
  style,
  centered = true,
}: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const linkColors = authLinkColors(colors);

  return (
    <Text
      style={[
        authLinkStyles.legalText,
        { color: linkColors.legalMuted },
        centered ? styles.centered : styles.left,
        style,
      ]}>
      {prefix}{' '}
      <Text
        style={[authLinkStyles.legalLink, { color: linkColors.legalLink }]}
        onPress={() => router.push('/legal/terms')}>
        Terms of Service
      </Text>
      {' '}and{' '}
      <Text
        style={[authLinkStyles.legalLink, { color: linkColors.legalLink }]}
        onPress={() => router.push('/legal/privacy')}>
        Privacy Policy
      </Text>
      .
    </Text>
  );
}

const styles = StyleSheet.create({
  centered: { textAlign: 'center' },
  left: { textAlign: 'left' },
});
