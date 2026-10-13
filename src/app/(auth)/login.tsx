import { useSignIn } from '@clerk/expo';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { authLinkColors, authLinkStyles } from '@/components/auth/auth-link-styles';
import { AuthCheckbox } from '@/components/auth/AuthCheckbox';
import { AuthFooter } from '@/components/auth/AuthFooter';
import { AuthLegalLinks } from '@/components/auth/AuthLegalLinks';
import { AuthScreenEnter } from '@/components/auth/AuthMotion';
import { AuthPrimaryButton } from '@/components/auth/AuthPrimaryButton';
import { AuthTextField } from '@/components/auth/AuthTextField';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';
import { Wordmark } from '@/components/ui/Wordmark';
import { useTheme } from '@/hooks/useTheme';
import { formatAuthError } from '@/lib/auth-errors';
import {
    getRememberedEmail,
    getRememberMe,
    setRememberedEmail,
    setRememberMe,
} from '@/lib/remember-me-storage';
import { sanitizeEmailInput, sanitizePasswordInput } from '@/lib/sanitize-input';

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const linkColors = authLinkColors(colors);
  const { signIn, errors, fetchStatus } = useSignIn();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMeChecked] = useState(true);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

  const loading = fetchStatus === 'fetching';

  useEffect(() => {
    let cancelled = false;

    async function loadPrefs() {
      const [savedRememberMe, savedEmail] = await Promise.all([getRememberMe(), getRememberedEmail()]);
      if (cancelled) return;
      setRememberMeChecked(savedRememberMe);
      if (savedEmail) setEmail(savedEmail);
      setPrefsLoaded(true);
    }

    loadPrefs();

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          bounces={false}>
          <AuthScreenEnter style={styles.enter}>
            <View style={styles.brand}>
              <Wordmark size={34} />
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Welcome back to your space
              </Text>
            </View>

            <View style={styles.form}>
              <AuthTextField
                label="Email"
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                value={email}
                onChangeText={(text) => setEmail(sanitizeEmailInput(text))}
              />
              {errors.fields.identifier && (
                <Text style={[styles.fieldError, { color: colors.error }]}>
                  {errors.fields.identifier.message}
                </Text>
              )}

              <PasswordInput
                label="Password"
                autoComplete="password"
                value={password}
                onChangeText={(text) => setPassword(sanitizePasswordInput(text))}
              />
              {errors.fields.password && (
                <Text style={[styles.fieldError, { color: colors.error }]}>
                  {errors.fields.password.message}
                </Text>
              )}

              <View style={styles.optionsRow}>
                <AuthCheckbox
                  checked={rememberMe}
                  onToggle={() => setRememberMeChecked((v) => !v)}
                  label="Remember me"
                />

                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/(auth)/forgot-password',
                      params: email ? { email } : undefined,
                    })
                  }
                  hitSlop={8}>
                  <Text style={[authLinkStyles.inlineLink, styles.forgotLink, { color: linkColors.emphasis }]}>
                    Forgot password?
                  </Text>
                </Pressable>
              </View>

              <AuthPrimaryButton
                label={loading ? 'Signing in…' : 'Sign In'}
                onPress={handleLogin}
                loading={loading}
                disabled={!email || !password || !prefsLoaded}
              />
            </View>

            <SocialAuthButtons onSuccess={() => router.replace('/')} />

            <AuthLegalLinks prefix="By signing in, you agree to our" style={styles.legalNotice} />

            {/* The same create-account page as the welcome flow (not the old sign-up screen). */}
            <AuthFooter prompt="New here?" linkLabel="Create account" href="/(auth)/get-started" />
          </AuthScreenEnter>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 28, justifyContent: 'center' },
  enter: { width: '100%' },
  brand: { alignItems: 'center', marginBottom: 24, gap: 12 },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 6, lineHeight: 21, maxWidth: 280 },
  form: { gap: 10 },
  fieldError: { fontSize: 13, marginTop: -4 },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  forgotLink: { fontSize: 14 },
  legalNotice: {
    marginTop: 20,
    paddingHorizontal: 8,
  },
});
