import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppleIcon, GoogleIcon } from '@/components/auth/OAuthBrandIcon';
import { useTheme } from '@/hooks/useTheme';
import { signInWithApple, signInWithGoogle } from '@/lib/oauth';

type Props = {
  onSuccess: () => void;
  requireTerms?: boolean;
  agreedToTerms?: boolean;
};

export function SocialAuthButtons({ onSuccess, requireTerms = false, agreedToTerms = true }: Props) {
  const { colors } = useTheme();
  const [loadingProvider, setLoadingProvider] = useState<'apple' | 'google' | null>(null);

  const guardTerms = () => {
    if (requireTerms && !agreedToTerms) {
      Alert.alert('Terms required', 'Please agree to the Terms of Service and Privacy Policy to continue.');
      return false;
    }
    return true;
  };

  const handleApple = async () => {
    if (!guardTerms()) return;
    setLoadingProvider('apple');
    try {
      const signedIn = await signInWithApple();
      if (signedIn) onSuccess();
    } catch (e: unknown) {
      Alert.alert('Apple sign in failed', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleGoogle = async () => {
    if (!guardTerms()) return;
    setLoadingProvider('google');
    try {
      const signedIn = await signInWithGoogle();
      if (signedIn) onSuccess();
    } catch (e: unknown) {
      Alert.alert('Google sign in failed', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setLoadingProvider(null);
    }
  };

  const showApple = Platform.OS === 'ios' || Platform.OS === 'android';
  const busy = loadingProvider !== null;
  const appleOnDark = colors.isDark;
  const appleBackground = appleOnDark ? '#FFFFFF' : '#000000';
  const appleForeground = appleOnDark ? '#000000' : '#FFFFFF';

  return (
    <View style={styles.container}>
      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: colors.borderStrong }]} />
        <Text style={[styles.dividerText, { color: colors.textSecondary }]}>or continue with</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.borderStrong }]} />
      </View>

      {showApple && (
        <Pressable
          style={[
            styles.btn,
            styles.appleBtn,
            {
              backgroundColor: appleBackground,
              borderColor: appleOnDark ? colors.borderStrong : 'transparent',
              borderWidth: appleOnDark ? StyleSheet.hairlineWidth : 0,
              opacity: busy && loadingProvider !== 'apple' ? 0.6 : 1,
            },
          ]}
          onPress={handleApple}
          disabled={busy}>
          {loadingProvider === 'apple' ? (
            <ActivityIndicator color={appleForeground} />
          ) : (
            <View style={styles.btnContent}>
              <AppleIcon size={20} color={appleForeground} />
              <Text style={[styles.appleBtnText, { color: appleForeground }]}>Continue with Apple</Text>
            </View>
          )}
        </Pressable>
      )}

      <Pressable
        style={[
          styles.btn,
          styles.googleBtn,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: busy && loadingProvider !== 'google' ? 0.6 : 1,
          },
        ]}
        onPress={handleGoogle}
        disabled={busy}>
        {loadingProvider === 'google' ? (
          <ActivityIndicator color={colors.text} />
        ) : (
          <View style={styles.btnContent}>
            <GoogleIcon size={18} />
            <Text style={[styles.googleBtnText, { color: colors.text }]}>Continue with Google</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
    marginTop: 8,
  },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appleBtn: {},
  appleBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  googleBtn: {
    borderWidth: 1,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    minHeight: 1,
    borderRadius: 1,
  },
  dividerText: {
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
});
