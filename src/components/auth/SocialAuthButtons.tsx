import { useSSO } from '@clerk/expo/experimental';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppleIcon, GoogleIcon } from '@/components/auth/OAuthBrandIcon';
import { colorWithAlpha } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { formatAuthError } from '@/lib/auth-errors';

type Props = {
  onSuccess: () => void;
  requireTerms?: boolean;
  agreedToTerms?: boolean;
};

export function SocialAuthButtons({ onSuccess, requireTerms = false, agreedToTerms = true }: Props) {
  const { colors } = useTheme();
  const { startSSOFlow } = useSSO();
  const [loadingProvider, setLoadingProvider] = useState<'apple' | 'google' | null>(null);

  const guardTerms = () => {
    if (requireTerms && !agreedToTerms) {
      Alert.alert('Terms required', 'Please agree to the Terms of Service and Privacy Policy to continue.');
      return false;
    }
    return true;
  };

  const handleSSO = async (strategy: 'oauth_apple' | 'oauth_google', provider: 'apple' | 'google') => {
    if (!guardTerms()) return;
    const label = provider === 'apple' ? 'Apple' : 'Google';
    setLoadingProvider(provider);
    try {
      const { createdSessionId, signIn, signUp } = await startSSOFlow({ strategy });
      if (createdSessionId) {
        onSuccess();
        return;
      }

      if (signIn?.existingSession || signUp?.existingSession) {
        Alert.alert(
          `Already signed in with ${label}`,
          'This account is already signed in on another session. Sign out there first, or use a different account.',
        );
        return;
      }

      if (signUp?.status === 'missing_requirements') {
        Alert.alert(
          `${label} sign up incomplete`,
          'Your account needs additional info to finish signing up. Please try again or use email instead.',
        );
        return;
      }

      // No createdSessionId, no error, and none of the above — the user cancelled the flow.
    } catch (e: unknown) {
      Alert.alert(`${label} sign in failed`, formatAuthError(e));
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleApple = () => handleSSO('oauth_apple', 'apple');
  const handleGoogle = () => handleSSO('oauth_google', 'google');

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
              // Apple's button is always solid black/white regardless of app theme,
              // so `colors.border` (tuned for the page's own background) isn't
              // guaranteed to show up against it — paper's border is solid black,
              // which would vanish on this button's own black fill. A border
              // derived from the pill's own foreground color always contrasts
              // against its paired background, and the hairline width matches
              // every other input/button border in the app.
              borderColor: colorWithAlpha(appleForeground, 0.18),
              borderWidth: StyleSheet.hairlineWidth,
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
    gap: 10,
    marginTop: 6,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  appleBtn: {},
  appleBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  googleBtn: {
    // Matches the hairline weight of AuthTextField and the other OAuth buttons.
    borderWidth: StyleSheet.hairlineWidth,
  },
  googleBtnText: {
    fontSize: 15,
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
