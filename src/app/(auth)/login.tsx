import { useSignIn } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthCheckbox } from '@/components/auth/AuthCheckbox';
import { AuthChoiceButton } from '@/components/auth/AuthChoiceButton';
import { AuthLegalLinks } from '@/components/auth/AuthLegalLinks';
import { AuthTextField } from '@/components/auth/AuthTextField';
import { AppleIcon, GoogleIcon } from '@/components/auth/OAuthBrandIcon';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { useSocialSignIn } from '@/components/auth/useSocialSignIn';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { useTheme } from '@/hooks/useTheme';
import { formatAuthError } from '@/lib/auth-errors';
import {
  getRememberedEmail,
  getRememberMe,
  setRememberedEmail,
  setRememberMe,
} from '@/lib/remember-me-storage';
import { goBackOrReplace } from '@/lib/router';
import { sanitizeEmailInput, sanitizePasswordInput } from '@/lib/sanitize-input';

/**
 * Sign in, in the onboarding style (same frame as the email sign-up and
 * verify pages): Apple / Google first, then email and password, with the
 * Sign in button over the keyboard.
 */
export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { signIn, errors, fetchStatus } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMeChecked] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const social = useSocialSignIn({ onSuccess: () => router.replace('/') });
  const showApple = Platform.OS === 'ios' || Platform.OS === 'android';

  const loading = fetchStatus === 'fetching';

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [savedRememberMe, savedEmail] = await Promise.all([getRememberMe(), getRememberedEmail()]);
      if (cancelled) return;
      setRememberMeChecked(savedRememberMe);
      if (savedEmail) setEmail(savedEmail);
      setPrefsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async () => {
    const cleanIdentifier = sanitizeEmailInput(email).trim();
    const cleanPassword = sanitizePasswordInput(password);
    if (!cleanIdentifier || !cleanPassword) return;

    await Promise.all([
      setRememberMe(rememberMe),
      rememberMe ? setRememberedEmail(cleanIdentifier) : Promise.resolve(),
    ]);

    const { error } = await signIn.password({ identifier: cleanIdentifier, password: cleanPassword });
    if (error) {
      Alert.alert('Sign in failed', formatAuthError(error));
      return;
    }

    if (signIn.status === 'complete') {
      await signIn.finalize({ navigate: () => router.replace('/') });
    } else if (signIn.status === 'needs_second_factor') {
      Alert.alert('Verification required', 'Two-factor sign-in is not supported yet in this app.');
    }
  };

  return (
    <OnboardingStepScreen
      title="Welcome back"
      subtitle="Sign in to your space."
      centered
      primaryLabel={loading ? 'Signing in…' : 'Sign in'}
      onPrimary={() => void handleLogin()}
      primaryDisabled={!email || !password || !prefsLoaded || social.busy}
      busy={loading}
      // Swap rather than stack, so switching between the two never piles up screens.
      secondaryLabel="New here? Create an account"
      onSecondary={() => router.replace('/(auth)/get-started')}
      onBack={() => goBackOrReplace(router, '/(auth)/welcome')}>
      <View style={styles.social}>
        {showApple ? (
          <AuthChoiceButton
            variant="filled"
            label="Continue with Apple"
            icon={<AppleIcon size={20} color={colors.background} />}
            onPress={() => void social.start('apple')}
            loading={social.loadingProvider === 'apple'}
            disabled={social.busy || loading}
          />
        ) : null}
        <AuthChoiceButton
          label="Continue with Google"
          icon={<GoogleIcon size={18} />}
          onPress={() => void social.start('google')}
          loading={social.loadingProvider === 'google'}
          disabled={social.busy || loading}
        />
      </View>

      <View style={styles.orRow}>
        <View style={[styles.orLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.orText, { color: colors.textTertiary }]}>or with email</Text>
        <View style={[styles.orLine, { backgroundColor: colors.border }]} />
      </View>

      <AuthTextField
        variant="bold"
        label="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        value={email}
        onChangeText={(text) => setEmail(sanitizeEmailInput(text))}
        returnKeyType="next"
      />
      {errors.fields.identifier ? (
        <Text style={[styles.fieldError, { color: colors.error }]}>{errors.fields.identifier.message}</Text>
      ) : null}

      <PasswordInput
        variant="bold"
        label="Password"
        autoComplete="password"
        value={password}
        onChangeText={(text) => setPassword(sanitizePasswordInput(text))}
      />
      {errors.fields.password ? (
        <Text style={[styles.fieldError, { color: colors.error }]}>{errors.fields.password.message}</Text>
      ) : null}

      <View style={styles.optionsRow}>
        <AuthCheckbox checked={rememberMe} onToggle={() => setRememberMeChecked((v) => !v)} label="Remember me" />
        <Pressable
          onPress={() => router.push({ pathname: '/(auth)/forgot-password', params: email ? { email } : undefined })}
          hitSlop={8}
          accessibilityRole="link">
          <Text style={[styles.forgot, { color: colors.text }]}>Forgot password?</Text>
        </Pressable>
      </View>

      <AuthLegalLinks prefix="By signing in you agree to our" style={styles.legal} />
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  social: { gap: 12 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 2 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  orText: { fontSize: 13, fontWeight: '800' },
  fieldError: { fontSize: 13, marginTop: -6 },
  optionsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  forgot: { fontSize: 14, fontWeight: '800', textDecorationLine: 'underline' },
  legal: { marginTop: 4 },
});
