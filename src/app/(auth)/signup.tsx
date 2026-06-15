import { useRouter } from 'expo-router';
import { useState } from 'react';
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
import { supabase } from '@/lib/supabase';

export default function SignupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!name.trim() || !email || !password || !agreedToTerms) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name: name.trim() } },
      });
      if (error) throw error;

      if (data.session) {
        await hydrateAuthSession(data.session);
        router.replace('/(onboarding)/profile-setup');
        return;
      }

      router.push({
        pathname: '/(auth)/verify-otp',
        params: { email: email.trim(), type: 'signup' },
      });
    } catch (e: unknown) {
      Alert.alert('Sign up failed', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setLoading(false);
    }
  };

  const finishOAuthSignup = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      await hydrateAuthSession(session);
      router.replace('/(onboarding)/profile-setup');
    }
  };

  const canSubmit = name.trim().length > 0 && email.length > 0 && password.length >= 6 && agreedToTerms && !loading;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brand}>
            <Text style={[styles.logo, { color: colors.text }]}>Create your space</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              A private home for you and your partner
            </Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              placeholder="Your name"
              placeholderTextColor={colors.textTertiary}
              autoComplete="name"
              value={name}
              onChangeText={setName}
            />
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
              placeholder="Password (min 6 characters)"
              autoComplete="new-password"
              value={password}
              onChangeText={setPassword}
            />

            <View style={styles.agreementRow}>
              <Pressable
                onPress={() => setAgreedToTerms((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: agreedToTerms }}
                hitSlop={8}>
                <View
                  style={[
                    styles.checkbox,
                    { borderColor: colors.border, backgroundColor: colors.surface },
                    agreedToTerms && { backgroundColor: colors.accent, borderColor: colors.accent },
                  ]}>
                  {agreedToTerms && <Text style={styles.checkmark}>✓</Text>}
                </View>
              </Pressable>
              <AuthLegalLinks prefix="I agree to the" style={styles.agreementText} />
            </View>

            <PrimaryButton label={loading ? 'Creating…' : 'Create Account'} onPress={handleSignup} loading={loading} disabled={!canSubmit} />
          </View>

          <SocialAuthButtons
            onSuccess={finishOAuthSignup}
            requireTerms
            agreedToTerms={agreedToTerms}
          />

          <AuthFooter prompt="Already have an account?" linkLabel="Sign in" href="/(auth)/login" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 28 },
  logo: { fontSize: 32, fontWeight: '800', textAlign: 'center', letterSpacing: -0.6 },
  subtitle: { fontSize: 16, textAlign: 'center', marginTop: 8, lineHeight: 22, maxWidth: 280 },
  form: { gap: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
  },
  agreementRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 4 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkmark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  agreementText: { flex: 1, textAlign: 'left' },
});
