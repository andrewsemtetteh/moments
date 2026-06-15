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
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthFooter } from '@/components/auth/AuthFooter';
import { AuthLegalLinks } from '@/components/auth/AuthLegalLinks';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { SocialAuthButtons } from '@/components/auth/SocialAuthButtons';
import { PrimaryButton } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { hydrateAuthSession } from '@/lib/auth-session';
import {
    getRememberedEmail,
    getRememberMe,
    setRememberedEmail,
    setRememberMe,
} from '@/lib/remember-me-storage';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const { colors } = useTheme();
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
    if (session) await hydrateAuthSession(session);
    router.replace('/');
  };

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!data.session) {
        throw new Error('Sign in succeeded but no session was returned. Please try again.');
      }

      await setRememberMe(rememberMe);
      if (rememberMe) {
        await setRememberedEmail(email);
      }

      await hydrateAuthSession(data.session);
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
          <View style={styles.brand}>
            <Text style={[styles.logo, { color: colors.text }]}>Moments</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Welcome back to your relationship space
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              placeholder="Email"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={setEmail}
            />
            <PasswordInput
              placeholder="Password"
              autoComplete="password"
              value={password}
              onChangeText={setPassword}
            />

            <View style={styles.optionsRow}>
              <Pressable
                onPress={() => setRememberMeChecked((v) => !v)}
                style={styles.rememberRow}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: rememberMe }}
                hitSlop={4}>
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    rememberMe && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}>
                  {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={[styles.rememberLabel, { color: colors.textSecondary }]}>Remember me</Text>
              </Pressable>

              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(auth)/forgot-password',
                    params: email ? { email } : undefined,
                  })
                }
                hitSlop={8}>
                <Text style={[styles.forgotLink, { color: colors.accent }]}>Forgot password?</Text>
              </Pressable>
            </View>

            <PrimaryButton
              label={loading ? 'Signing in…' : 'Sign In'}
              onPress={handleLogin}
              loading={loading}
              disabled={!email || !password || !prefsLoaded}
            />
          </View>

          <SocialAuthButtons onSuccess={finishAuth} />

          <AuthLegalLinks prefix="By signing in, you agree to our" style={styles.legalNotice} />

          <AuthFooter prompt="New here?" linkLabel="Create account" href="/(auth)/signup" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 32 },
  logo: { fontSize: 36, fontWeight: '800', textAlign: 'center', letterSpacing: -0.8 },
  subtitle: { fontSize: 16, textAlign: 'center', marginTop: 8, lineHeight: 22, maxWidth: 280 },
  form: { gap: 12 },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  rememberLabel: { fontSize: 15 },
  forgotLink: { fontSize: 14, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
  },
  legalNotice: {
    marginTop: 24,
    paddingHorizontal: 8,
  },
});
