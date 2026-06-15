import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { ensureUserProfile } from '@/lib/auth-session';
import { markAvatarPromptDone } from '@/lib/onboarding-storage';
import { supabase } from '@/lib/supabase';
import * as api from '@/services/api';
import { useAuthStore } from '@/stores';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar_url ?? null);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(!user);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapProfile() {
      if (user) {
        setAvatarUri(user.avatar_url);
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
        setAvatarUri(profile.avatar_url);
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

  const continue_ = async () => {
    const activeUser = useAuthStore.getState().user;
    if (!activeUser) return;
    setLoading(true);
    try {
      let avatarUrl = activeUser.avatar_url;

      if (avatarUri && avatarUri !== activeUser.avatar_url && !avatarUri.startsWith('http')) {
        avatarUrl = await api.uploadProfileAvatar(activeUser.id, avatarUri);
      }

      if (avatarUrl && avatarUrl !== activeUser.avatar_url) {
        const updated = await api.updateProfile(activeUser.id, { avatar_url: avatarUrl });
        setUser(updated);
      }

      await markAvatarPromptDone(activeUser.id);
      router.push('/(onboarding)/create-relationship');
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not save profile photo');
    } finally {
      setLoading(false);
    }
  };

  const displayName = user?.name?.trim() || 'there';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Add a profile photo</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Hi {displayName} 
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

        <Text style={[styles.hint, { color: colors.textTertiary }]}>Tap to choose from your library</Text>

        <PrimaryButton
          label={loading ? 'Saving…' : 'Continue'}
          onPress={continue_}
          loading={loading}
          disabled={bootstrapping}
          style={styles.btn}
        />

        <Pressable
          onPress={async () => {
            const activeUser = useAuthStore.getState().user;
            if (activeUser) await markAvatarPromptDone(activeUser.id);
            router.push('/(onboarding)/create-relationship');
          }}
          disabled={bootstrapping || loading}>
          <Text style={[styles.skip, { color: colors.textSecondary }]}>Skip for now</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 22, marginTop: 10, maxWidth: 300 },
  avatarWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    marginTop: 32,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  editBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: { fontSize: 13, marginTop: 12, textAlign: 'center' },
  btn: { width: '100%', marginTop: 32 },
  skip: { fontSize: 15, marginTop: 16, textAlign: 'center' },
});
