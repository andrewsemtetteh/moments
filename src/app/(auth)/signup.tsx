import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

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
import { formatAuthError, registerAccount } from '@/lib/auth-otp';
import { hydrateAuthSession } from '@/lib/auth-session';
import { sanitizeEmailInput, sanitizePasswordInput } from '@/lib/sanitize-input';
import { supabase } from '@/lib/supabase';

export default function SignupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    const cleanEmail = sanitizeEmailInput(email).trim();
    const cleanPassword = sanitizePasswordInput(password);
    if (!cleanEmail || !cleanPassword || !agreedToTerms) return;
    setLoading(true);
    try {
      const result = await registerAccount({
        email: cleanEmail,
        password: cleanPassword,
      });

      if (result.error) throw result.error;

      if (result.session) {
        await hydrateAuthSession(result.session);
        router.replace('/(onboarding)/profile-name');
        return;
      }

      if (!result.needsVerification) {
        throw new Error('Could not finish sign up. Please try again.');
      }

      router.push({
        pathname: '/(auth)/check-email',
        params: { email: result.email, type: 'signup' },
      });
    } catch (e: unknown) {
      Alert.alert('Sign up failed', formatAuthError(e));
    } finally {
      setLoading(false);
    }
  };

  const finishOAuthSignup = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await hydrateAuthSession(session);
      router.replace('/(onboarding)/profile-name');
    }
  };

  const canSubmit = email.length > 0 && password.length >= 6 && agreedToTerms && !loading;

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
              <Text style={[styles.logo, { color: colors.text }]}>Create your space</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                A private home for you and your partner
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
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChangeText={(text) => setPassword(sanitizePasswordInput(text))}
              />

              <View style={styles.agreementRow}>
                <View style={styles.checkboxWrap}>
                  <AuthCheckbox
                    checked={agreedToTerms}
                    onToggle={() => setAgreedToTerms((v) => !v)}
                    hitSlop={8}
                  />
                </View>
                <AuthLegalLinks prefix="I agree to the" style={styles.agreementText} />
              </View>

              <AuthPrimaryButton label={loading ? 'Creating…' : 'Create Account'} onPress={handleSignup} loading={loading} disabled={!canSubmit} />
            </View>

            <SocialAuthButtons
              onSuccess={finishOAuthSignup}
              requireTerms
              agreedToTerms={agreedToTerms}
            />

            <AuthFooter prompt="Already have an account?" linkLabel="Sign in" href="/(auth)/login" />
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
  logo: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.6 },
  subtitle: { fontSize: 15, textAlign: 'center', marginTop: 6, lineHeight: 21, maxWidth: 280 },
  form: { gap: 10 },
  agreementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 2 },
  checkboxWrap: { marginTop: 1 },
  agreementText: { flex: 1, textAlign: 'left' },
});
