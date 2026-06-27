import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingChrome } from '@/components/onboarding/OnboardingChrome';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { ensureUserProfile } from '@/lib/auth-session';
import { markAvatarPromptDone } from '@/lib/onboarding-storage';
import { goToOnboardingBack } from '@/lib/onboarding-navigation';
import { needsProfileName } from '@/lib/profile-setup';
import { supabase } from '@/lib/supabase';
import * as api from '@/services/api';
import { useAuthStore } from '@/stores';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar_url ?? null);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(!user);

  useEffect(() => {
    if (!user) return;
    if (needsProfileName(user)) {
      router.replace('/(onboarding)/profile-name');
      return;
    }
    setAvatarUri(user.avatar_url);
  }, [user, router]);

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

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to set your profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  };

  const continue_ = async (skipPhoto = false) => {
    const activeUser = useAuthStore.getState().user;
    if (!activeUser) return;
    setLoading(true);
    try {
      let currentUser = activeUser;

      if (!skipPhoto) {
        let avatarUrl = currentUser.avatar_url;

        if (avatarUri && avatarUri !== currentUser.avatar_url && !avatarUri.startsWith('http')) {
          avatarUrl = await api.uploadProfileAvatar(currentUser.id, avatarUri);
        }

        if (avatarUrl && avatarUrl !== currentUser.avatar_url) {
          currentUser = await api.updateProfile(currentUser.id, { avatar_url: avatarUrl });
          setUser(currentUser);
        }
      }

      await markAvatarPromptDone(currentUser.id);
      router.push('/(onboarding)/profile-gender');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save profile photo');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => goToOnboardingBack(router, 'profile-setup');

  return (
    <OnboardingChrome stepId="profile-setup" onBack={goBack}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.lg, paddingHorizontal: Spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Add a profile photo</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Help your partner recognize you. You can always change this later.
          </Text>

          <Pressable
            onPress={pickPhoto}
            disabled={bootstrapping}
            style={[styles.avatarWrap, { borderColor: colors.border, backgroundColor: colors.surface }]}
            accessibilityLabel="Choose profile photo">
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} contentFit="cover" />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.surfaceElevated }]}>
                <Icon name="camera" size={32} color={colors.textSecondary} />
              </View>
            )}
            <View style={[styles.editBadge, { backgroundColor: colors.accent }]}>
              <Icon name="plus" size={16} color={colors.onAccent} strokeWidth={2.5} />
            </View>
          </Pressable>

          <Text style={[styles.hint, { color: colors.textTertiary }]}>Optional</Text>

          <PrimaryButton
            label={loading ? 'Saving…' : 'Continue'}
            onPress={() => continue_()}
            loading={loading}
            disabled={bootstrapping}
            style={styles.btn}
          />

          <Pressable onPress={() => continue_(true)} disabled={bootstrapping || loading}>
            <Text style={[styles.skip, { color: colors.textSecondary }]}>Skip photo for now</Text>
          </Pressable>
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
  avatarWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    marginTop: 28,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 70 },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 70,
    overflow: 'hidden',
  },
  editBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 10,
  },
  hint: { fontSize: 13, marginTop: 12, textAlign: 'center' },
  btn: { width: '100%', marginTop: 32 },
  skip: { fontSize: 15, marginTop: 16, textAlign: 'center' },
});
