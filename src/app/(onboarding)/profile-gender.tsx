import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingChrome } from '@/components/onboarding/OnboardingChrome';
import { PrimaryButton } from '@/components/ui/primitives';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { ensureUserProfile } from '@/lib/auth-session';
import { isAvatarPromptDone } from '@/lib/onboarding-storage';
import { goToOnboardingBack } from '@/lib/onboarding-navigation';
import { needsProfileName, needsProfilePhoto } from '@/lib/profile-setup';
import { PROFILE_GENDER_OPTIONS } from '@/lib/profile-gender';
import { supabase } from '@/lib/supabase';
import * as api from '@/services/api';
import { useAuthStore } from '@/stores';
import type { ProfileGender } from '@/types/database';

export default function ProfileGenderScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [gender, setGender] = useState<ProfileGender | null>(user?.gender ?? null);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(!user);

  useEffect(() => {
    if (!user) return;
    setGender(user.gender ?? null);
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapProfile() {
      if (user) {
        if (needsProfileName(user)) {
          router.replace('/(onboarding)/profile-name');
          return;
        }
        const avatarDone = await isAvatarPromptDone(user.id);
        if (needsProfilePhoto(user, avatarDone)) {
          router.replace('/(onboarding)/profile-setup');
          return;
        }
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

        const avatarDone = await isAvatarPromptDone(profile.id);
        if (needsProfileName(profile)) {
          router.replace('/(onboarding)/profile-name');
          return;
        }
        if (needsProfilePhoto(profile, avatarDone)) {
          router.replace('/(onboarding)/profile-setup');
          return;
        }
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

  const selectGender = (value: ProfileGender) => {
    void Haptics.selectionAsync();
    setGender(value);
  };

  const saveGender = async () => {
    const activeUser = useAuthStore.getState().user;
    if (!activeUser || !gender) return;

    setLoading(true);
    try {
      if (gender !== activeUser.gender) {
        const updated = await api.updateProfile(activeUser.id, { gender });
        setUser(updated);
      }

      router.push('/(onboarding)/anniversary-setup');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save your selection');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => goToOnboardingBack(router, 'profile-gender');

  return (
    <OnboardingChrome stepId="profile-gender" onBack={goBack}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.lg, paddingHorizontal: Spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>How do you identify?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            This helps us personalize your experience. You can change this later in settings.
          </Text>

          <View style={styles.options}>
            {PROFILE_GENDER_OPTIONS.map((option) => {
              const selected = gender === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => selectGender(option.value)}
                  disabled={bootstrapping}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: selected ? colors.accentSoft : colors.surface,
                      borderColor: selected ? colors.accent : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}>
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: selected ? colors.accent : colors.text },
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <PrimaryButton
            label={loading ? 'Saving…' : 'Continue'}
            onPress={saveGender}
            loading={loading}
            disabled={bootstrapping || !gender}
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
  options: { width: '100%', marginTop: 28, gap: 12 },
  option: {
    width: '100%',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
  },
  optionLabel: { fontSize: 17, fontWeight: '600' },
  btn: { width: '100%', marginTop: 32 },
});
