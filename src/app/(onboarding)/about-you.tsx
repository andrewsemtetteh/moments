import { useAuth, useUser } from '@clerk/expo';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput } from '@/components/ui/ThemedTextInput';

import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { ensureUserProfile } from '@/lib/auth-session';
import { uploadMyAvatar, updateMyProfile } from '@/lib/moments-api';
import { goNext, previewAnswers } from '@/lib/onboarding-v2';
import { markAvatarPromptDone } from '@/lib/onboarding-storage';
import { ensurePermission } from '@/lib/permissions';
import { isPlaceholderProfileName } from '@/lib/profile-setup';
import { sanitizeNameInput } from '@/lib/sanitize-input';
import { useAuthStore } from '@/stores';

/** Step 1: what your person calls you, and a photo if you like (filled in from Apple/Google). */
export default function AboutYouScreen() {
  const router = useRouter();
  const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { user: clerkUser } = useUser();
  const { getToken } = useAuth();
  // Filled in from the profile, or from Apple/Google (their first name) on a
  // brand-new account; they can change it either way.
  const [name, setName] = useState(() =>
    user?.name && !isPlaceholderProfileName(user.name, user.email)
      ? user.name
      : (clerkUser?.firstName ?? clerkUser?.fullName ?? '').trim(),
  );
  const [photo, setPhoto] = useState<string | null>(user?.avatar_url ?? null);
  const [busy, setBusy] = useState(false);

  // Signed in but no profile row yet (first launch after sign-up): make one.
  useEffect(() => {
    if (preview || user || !clerkUser) return;
    let cancelled = false;
    void ensureUserProfile({
      id: clerkUser.id,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
      name: clerkUser.fullName,
    })
      .then((profile) => {
        if (cancelled) return;
        setUser(profile);
        if (profile.name && !isPlaceholderProfileName(profile.name, profile.email)) setName(profile.name);
        if (profile.avatar_url) setPhoto(profile.avatar_url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [preview, user, clerkUser, setUser]);

  const pickPhoto = async () => {
    if (!(await ensurePermission('photos'))) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) setPhoto(result.assets[0].uri);
  };

  const save = async (withPhoto: boolean) => {
    const clean = sanitizeNameInput(name).trim();
    if (!clean) {
      Alert.alert('Your name', 'Add a name or nickname for your person to see.');
      return;
    }
    if (preview) {
      previewAnswers.name = clean;
      await goNext(router, 'about-you', { preview });
      return;
    }
    setBusy(true);
    try {
      // The profile normally exists by now; if making it in the background failed (offline),
      // make it here instead of Continue silently doing nothing.
      let active = useAuthStore.getState().user;
      if (!active && clerkUser) {
        active = await ensureUserProfile({
          id: clerkUser.id,
          email: clerkUser.primaryEmailAddress?.emailAddress ?? null,
          name: clerkUser.fullName,
        });
        setUser(active);
      }
      if (!active) throw new Error('Check your connection and try again.');
      const token = await getToken();
      if (!token) throw new Error('Not signed in');
      let next = active;
      if (clean !== active.name?.trim()) next = await updateMyProfile(token, { name: clean });
      if (withPhoto && photo && !photo.startsWith('http')) next = await uploadMyAvatar(token, photo);
      // Removed the photo they came in with (e.g. from Google).
      if (!photo && next.avatar_url) next = await updateMyProfile(token, { avatar_url: null });
      setUser(next);
      await markAvatarPromptDone(next.id);
      await goNext(router, 'about-you', { userId: next.id });
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingStepScreen
      step="about-you"
      title="First, what should we call you?"
      subtitle="Your name or a nickname, whatever feels like you. Add a photo too if you like."
      primaryLabel="Continue"
      onPrimary={() => void save(true)}
      primaryDisabled={!name.trim()}
      busy={busy}
      // The first step: nowhere to go back to (sign-up is done).
      onBack={null}>
      <Pressable
        onPress={() => void pickPhoto()}
        accessibilityRole="button"
        accessibilityLabel="Add a profile photo"
        style={[styles.photo, { borderColor: colors.text, backgroundColor: colors.surfaceElevated }]}>
        {photo ? (
          <Image source={{ uri: photo }} style={styles.photoImage} contentFit="cover" />
        ) : (
          <Icon name="camera" size={34} color={colors.text} />
        )}
        <View style={[styles.photoBadge, { backgroundColor: colors.accent, borderColor: colors.background }]}>
          <Icon name={photo ? 'edit' : 'plus'} size={14} color={colors.onAccent} />
        </View>
      </Pressable>
      {photo ? (
        <View style={styles.photoActions}>
          <Pressable onPress={() => void pickPhoto()} hitSlop={8} accessibilityRole="button">
            <Text style={[styles.photoAction, { color: colors.text }]}>Change</Text>
          </Pressable>
          <View style={[styles.photoActionDot, { backgroundColor: colors.textTertiary }]} />
          <Pressable onPress={() => setPhoto(null)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove photo">
            <Text style={[styles.photoAction, { color: colors.error }]}>Remove</Text>
          </Pressable>
        </View>
      ) : (
        <Text style={[styles.photoHint, { color: colors.textSecondary }]}>Add a photo (optional)</Text>
      )}

      {/* Same field as "Name your space": the label sits inside as the placeholder. */}
      <TextInput
        value={name}
        onChangeText={(t) => setName(sanitizeNameInput(t))}
        placeholder="Name or nickname"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="words"
        autoComplete="name"
        returnKeyType="done"
        maxLength={32}
        style={[styles.input, { color: colors.text, borderColor: colors.text, backgroundColor: colors.surface }]}
      />
      <Text style={[styles.peek, { color: colors.textSecondary }]}>
        {name.trim() ? `Your person will see “${sanitizeNameInput(name).trim()}”` : 'This is what your person sees'}
      </Text>
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  photo: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoImage: { width: 112, height: 112, borderRadius: 56 },
  photoBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoHint: { textAlign: 'center', fontSize: 13, fontWeight: '700', marginTop: -2, marginBottom: 6 },
  // Breathing room between the photo and the name; same field as space-name.
  input: {
    marginTop: 22,
    height: 58,
    borderRadius: 16,
    borderWidth: 2,
    paddingHorizontal: 16,
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  photoActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginTop: -2 },
  photoAction: { fontSize: 14, fontWeight: '700' },
  photoActionDot: { width: 3, height: 3, borderRadius: 2 },
  peek: { fontSize: 13, textAlign: 'center', marginTop: -2 },
});
