import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthTextField } from '@/components/auth/AuthTextField';
import { OnboardingChrome } from '@/components/onboarding/OnboardingChrome';
import { PrimaryButton } from '@/components/ui/primitives';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { ensureUserProfile } from '@/lib/auth-session';
import { goToOnboardingBack } from '@/lib/onboarding-navigation';
import { isPlaceholderProfileName } from '@/lib/profile-setup';
import { sanitizeNameInput } from '@/lib/sanitize-input';
import { supabase } from '@/lib/supabase';
import * as api from '@/services/api';
import { useAuthStore } from '@/stores';

function initialNameFromProfile(name: string | null | undefined, email: string) {
  if (name?.trim() && !isPlaceholderProfileName(name, email)) {
    return name.trim();
  }
  return '';
}

export default function ProfileNameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(!user);

  useEffect(() => {
    if (!user) return;
    setName(initialNameFromProfile(user.name, user.email));
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapProfile() {
      if (user) {
        setBootstrapping(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace('/(auth)/login');
        return;
      }

      try {
        const profile = await ensureUserProfile(session.user);
        if (cancelled) return;
        setUser(profile);
      } catch (e: unknown) {
        Alert.alert(
          'Setup unavailable',
          e instanceof Error ? e.message : 'Could not load your profile. Check your connection and try again.',
        );
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }

    bootstrapProfile();

    return () => {
      cancelled = true;
    };
  }, [router, setUser, user]);

  const saveName = async () => {
    const activeUser = useAuthStore.getState().user;
    if (!activeUser) return;

    const cleanName = sanitizeNameInput(name).trim();
    if (!cleanName || isPlaceholderProfileName(cleanName, activeUser.email)) {
      Alert.alert('Your name', 'Please enter the name you\'d like to use.');
      return;
    }

    setLoading(true);
    try {
      if (cleanName !== activeUser.name?.trim()) {
        const updated = await api.updateProfile(activeUser.id, { name: cleanName });
        setUser(updated);
      }

      router.push('/(onboarding)/profile-setup');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save your name');
    } finally {
      setLoading(false);
    }
  };

  const nameIsValid =
    name.trim().length > 0 && (!user || !isPlaceholderProfileName(name, user.email));

  return (
    <OnboardingChrome stepId="profile-name" onBack={() => goToOnboardingBack(router, 'profile-name')}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.lg, paddingHorizontal: Spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>What&apos;s your name?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            This is how your partner will see you in your shared space.
          </Text>

          <View style={styles.nameField}>
            <AuthTextField
              label="Your name"
              autoComplete="name"
              value={name}
              onChangeText={(text) => setName(sanitizeNameInput(text))}
            />
          </View>

          <PrimaryButton
            label={loading ? 'Saving…' : 'Continue'}
            onPress={saveName}
            loading={loading}
            disabled={bootstrapping || !nameIsValid}
            style={styles.btn}
          />
        </View>
      </ScrollView>
    </OnboardingChrome>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 22, marginTop: 10, maxWidth: 300 },
  nameField: { width: '100%', marginTop: 28 },
  btn: { width: '100%', marginTop: 32 },
});
