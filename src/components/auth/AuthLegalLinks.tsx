import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { useRouter } from 'expo-router';

import { useTheme } from '@/hooks/useTheme';

type Props = {
  /** Lead-in copy before the linked legal documents. */
  prefix?: string;
  style?: StyleProp<TextStyle>;
};

export function AuthLegalLinks({
  prefix = 'By continuing, you agree to our',
  style,
}: Props) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Text style={[styles.text, { color: colors.textSecondary }, style]}>
      {prefix}{' '}
      <Text style={[styles.link, { color: colors.accent }]} onPress={() => router.push('/legal/terms')}>
        Terms of Service
      </Text>
      {' '}and{' '}
      <Text style={[styles.link, { color: colors.accent }]} onPress={() => router.push('/legal/privacy')}>
        Privacy Policy
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  link: {
    fontWeight: '600',
  },
});
