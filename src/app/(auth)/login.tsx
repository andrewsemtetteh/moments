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
import { LogoMark } from '@/components/ui/Logo';
import { useTheme } from '@/hooks/useTheme';
import { hydrateAuthSession } from '@/lib/auth-session';
import {
    getRememberedEmail,
    getRememberMe,
    setRememberedEmail,
    setRememberMe,
} from '@/lib/remember-me-storage';
import { sanitizeEmailInput, sanitizePasswordInput } from '@/lib/sanitize-input';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const linkColors = authLinkColors(colors);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMeChecked] = useState(true);
  const [loading, setLoading] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);

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

  const finishAuth = async () => {
    await setRememberMe(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) await hydrateAuthSession(session, false, { trustSession: true });
    router.replace('/');
  };

  const handleLogin = async () => {
    const cleanEmail = sanitizeEmailInput(email).trim();
    const cleanPassword = sanitizePasswordInput(password);
    if (!cleanEmail || !cleanPassword) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: cleanPassword,
      });
      if (error) throw error;
      if (!data.session) {
        throw new Error('Sign in succeeded but no session was returned. Please try again.');
      }

      await Promise.all([
        setRememberMe(rememberMe),
        rememberMe ? setRememberedEmail(cleanEmail) : Promise.resolve(),
        hydrateAuthSession(data.session, false, { trustSession: true }),
      ]);
      router.replace('/');
    } catch (e: unknown) {
      Alert.alert('Sign in failed', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <AuthScreenEnter style={styles.enter}>
            <View style={styles.brand}>
              <LogoMark size={72} />
              <Text style={[styles.logo, { color: colors.text }]}>Moments</Text>
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
              <PasswordInput
                label="Password"
                autoComplete="password"
                value={password}
                onChangeText={(text) => setPassword(sanitizePasswordInput(text))}
              />

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

            <SocialAuthButtons onSuccess={finishAuth} />

            <AuthLegalLinks prefix="By signing in, you agree to our" style={styles.legalNotice} />

            <AuthFooter prompt="New here?" linkLabel="Create account" href="/(auth)/signup" />
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
  logo: { fontSize: 32, fontWeight: '800', textAlign: 'center', letterSpacing: -0.8 },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 6, lineHeight: 21, maxWidth: 280 },
  form: { gap: 10 },
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
