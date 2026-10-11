import { useSSO } from '@clerk/expo/experimental';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState, type ReactNode } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthFooter } from '@/components/auth/AuthFooter';
import { AuthLegalLinks } from '@/components/auth/AuthLegalLinks';
import { AppleIcon, GoogleIcon } from '@/components/auth/OAuthBrandIcon';
import { OnboardingBackButton } from '@/components/onboarding/OnboardingChrome';
import { Radius, Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { formatAuthError } from '@/lib/auth-errors';
import { markIntroCompleted } from '@/lib/intro-storage';
import { goBackOrReplace } from '@/lib/router';

type Props = {
  showBack?: boolean;
};

export function GetStartedAuth({ showBack = true }: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { startSSOFlow } = useSSO();
  const [loadingProvider, setLoadingProvider] = useState<'apple' | 'google' | null>(null);
  const showApple = Platform.OS === 'ios' || Platform.OS === 'android';
  const busy = loadingProvider !== null;

  const handleSSO = async (strategy: 'oauth_apple' | 'oauth_google', provider: 'apple' | 'google') => {
    const label = provider === 'apple' ? 'Apple' : 'Google';
    setLoadingProvider(provider);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await markIntroCompleted();
      const { createdSessionId, signIn, signUp } = await startSSOFlow({ strategy });
      if (createdSessionId) {
        router.replace('/');
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

  const handleEmail = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await markIntroCompleted();
    router.push('/(auth)/signup-email');
  };

  const handleBack = () => goBackOrReplace(router, '/(auth)/welcome');

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.isDark ? 'light' : 'dark'} />
      <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
        {showBack ? (
          <View style={[styles.topBar, { paddingTop: insets.top + Spacing.lg + Spacing.sm }]}>
            <OnboardingBackButton onPress={handleBack} />
          </View>
        ) : (
          <View style={{ height: insets.top + Spacing.lg + Spacing.sm }} />
        )}

        <View style={styles.content}>
          <View style={styles.brandBlock}>
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>Closer, every day</Text>
          </View>

          <View style={styles.actions}>
            {showApple && (
              <OutlineAuthButton
                label="Continue with Apple"
                icon={<AppleIcon size={20} color={colors.text} />}
                onPress={handleApple}
                loading={loadingProvider === 'apple'}
                disabled={busy}
              />
            )}

            <OutlineAuthButton
              label="Continue with Google"
              icon={<GoogleIcon size={18} />}
              onPress={handleGoogle}
              loading={loadingProvider === 'google'}
              disabled={busy}
            />

            <Text style={[styles.or, { color: colors.textSecondary }]}>or</Text>

            <Pressable
              onPress={handleEmail}
              disabled={busy}
              style={({ pressed }) => [
                styles.emailBtn,
                { backgroundColor: colors.text, opacity: pressed || busy ? 0.9 : 1 },
              ]}>
              <Ionicons name="mail-outline" size={18} color={colors.background} style={styles.emailIcon} />
              <Text style={[styles.emailBtnText, { color: colors.background }]}>Continue with Email</Text>
            </Pressable>
          </View>

          <AuthFooter
            prompt="Already have an account?"
            linkLabel="Log in"
            href="/(auth)/login"
            onBeforeNavigate={markIntroCompleted}
          />

          <AuthLegalLinks
            prefix="By continuing you agree to our"
            style={styles.legalNotice}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

function OutlineAuthButton({
  label,
  icon,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  icon: ReactNode;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.outlineBtn,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed || (disabled && !loading) ? 0.82 : 1,
        },
      ]}>
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <View style={styles.outlineContent}>
          {icon}
          <Text style={[styles.outlineBtnText, { color: colors.text }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  topBar: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  content: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
    paddingBottom: Spacing.md,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 40,
  },
  tagline: {
    marginTop: 8,
    fontSize: 15,
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  actions: {
    gap: 12,
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  outlineBtn: {
    minHeight: 54,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  outlineContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  outlineBtnText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  or: {
    textAlign: 'center',
    fontSize: 15,
    fontStyle: 'italic',
    fontFamily: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
    marginVertical: 4,
  },
  emailBtn: {
    minHeight: 54,
    borderRadius: Radius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    gap: 10,
  },
  emailIcon: { opacity: 0.55 },
  emailBtnText: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  legalNotice: {
    marginTop: 16,
    paddingHorizontal: 8,
  },
});
