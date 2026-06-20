import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthFooter } from '@/components/auth/AuthFooter';
import { PrimaryButton } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { sendPasswordResetLink, formatAuthError } from '@/lib/auth-otp';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const trimmed = email.trim();
    if (!trimmed) return;

    setLoading(true);
    try {
      const { error } = await sendPasswordResetLink(trimmed);
      if (error) throw error;
      router.push({
        pathname: '/(auth)/check-email',
        params: { email: trimmed, type: 'recovery' },
      });
    } catch (e: unknown) {
      Alert.alert('Could not send email', formatAuthError(e));
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
          <View style={styles.content}>
            <View style={styles.brand}>
              <Text style={[styles.title, { color: colors.text }]}>Reset password</Text>
              <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                Enter your email and we&apos;ll send a 6-digit code to verify it&apos;s you.
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
              <PrimaryButton
                label={loading ? 'Sending…' : 'Send code'}
                onPress={handleSend}
                loading={loading}
                disabled={!email.trim() || loading}
              />
            </View>

            <AuthFooter prompt="Remember your password?" linkLabel="Back to sign in" href="/(auth)/login" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
  },
  content: { width: '100%', maxWidth: 400, alignSelf: 'center' },
  brand: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, textAlign: 'center', marginTop: 10, lineHeight: 22, maxWidth: 300 },
  form: { gap: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
  },
});
