import { useAuth, useUser } from '@clerk/expo';
import { format, parseISO } from 'date-fns';
import Constants from 'expo-constants';
import * as Haptics from '@/lib/haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppIconPicker } from '@/components/profile/AppIconPicker';
import { ChangePasswordModal, MIN_PASSWORD_LENGTH } from '@/components/profile/ChangePasswordModal';
import { EditAnniversaryModal } from '@/components/profile/EditAnniversaryModal';
import { EditFieldModal } from '@/components/profile/EditFieldModal';
import { AppSwitch } from '@/components/ui/AppSwitch';
import { DesignPreviewModal, type DesignPreviewKind } from '@/components/dev/DesignPreviewModal';
import { EditGenderModal } from '@/components/profile/EditGenderModal';
import { EditRelationshipTypeModal } from '@/components/profile/EditRelationshipTypeModal';
import { LocationSharingSettings } from '@/components/profile/LocationSharingSettings';
import { OnlineStatusSettings } from '@/components/profile/OnlineStatusSettings';
import { SettingsToggleDivider, SettingsToggleRow } from '@/components/profile/SettingsToggleRow';
import { VerifyEmailCodeModal } from '@/components/profile/VerifyEmailCodeModal';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar, colorWithAlpha, separatorColor } from '@/components/ui/primitives';
import { SOCIAL_LINKS, SUPPORT_EMAIL } from '@/constants/social';
import { THEME_GRID_FILLERS, THEME_META, Spacing, Themes, type AppTheme, type ThemeColors } from '@/constants/design-system';
import { usePlanActions } from '@/hooks/usePlanActions';
import { useSubscription } from '@/hooks/useSubscription';
import { REFERRAL_DAYS } from '@/constants/subscription';
import { useTheme } from '@/hooks/useTheme';
import { getRelationshipAnniversaryIso, isValidAnniversaryIso } from '@/lib/anniversary';
import { formatAuthError } from '@/lib/auth-errors';
import { signOutUser } from '@/lib/auth-session';
import { setDevPlus as setDevPlus_, deleteMyAccount, syncMyEmail } from '@/lib/moments-api';
import { openSubscriptionManagement, usePurchasesStore } from '@/lib/purchases';
import { notifyIsland } from '@/lib/in-app-notify';
import { loadExpoNotifications } from '@/lib/expo-notifications-safe';
import { getFirstName } from '@/lib/avatar-initial';
import { markRelationshipOnboardingDone } from '@/lib/onboarding-storage';
import { profileGender, profileGenderLabel } from '@/lib/profile-gender';
import { birthdayShortLabel, isOldEnough, latestBirthYear, MIN_AGE } from '@/lib/birthday';
import { relationshipTypeLabel } from '@/lib/relationship-type';
import { closeStackScreen } from '@/lib/router';
import { toUserFacingNetworkError } from '@/lib/network-error';
import { formatSubscriptionExpiry } from '@/lib/subscription';
import * as api from '@/services/api';
import { useAuthStore, useCallStore, useRelationshipStore, useUIStore } from '@/stores';
import type { ProfileGender, RelationshipType } from '@/types/database';
import { ensurePermission } from '@/lib/permissions';
import { useHapticsPref } from '@/lib/haptics';
import { askChoice } from '@/components/ui/ChoiceSheet';

type PendingEmailAddress = Awaited<
  ReturnType<NonNullable<ReturnType<typeof useUser>['user']>['createEmailAddress']>
>;

/**
 * Everything that's a setting rather than part of your relationship: account
 * details, appearance, relationship settings, privacy, support and sign-out.
 * Opened from the gear on the You tab; enters from the right (the gear sits
 * top-right) with the standard native push.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, theme, setTheme } = useTheme();
  const cardSurface = surfaceStyle(colors);
  const relationship = useRelationshipStore((s) => s.relationship);
  const setRelationship = useRelationshipStore((s) => s.setRelationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);
  const { getToken } = useAuth();
  const setUser = useAuthStore((s) => s.setUser);
  const { user: clerkUser } = useUser();
  const { isPlus, isOwner } = useSubscription();
  // Your plan: paywall (Free), Customer Center (paid here), or a note (partner pays).
  const { openPlan, restore: restorePlan } = usePlanActions();
  const plusExpiryLabel = formatSubscriptionExpiry(user?.subscription_expires_at);

  const [editField, setEditField] = useState<'name' | 'space' | 'email' | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  // Gender (optional): Male, Female, Non-binary, Other, Prefer not to say.
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [genderDraft, setGenderDraft] = useState<ProfileGender | null>(profileGender(user));
  const [savingGender, setSavingGender] = useState(false);
  // Birthday (optional): your partner gets a countdown and reminders.
  const [birthdayOpen, setBirthdayOpen] = useState(false);
  // Developer: pretend this phone has Plus (unlocks Endless and live games, every limit).
  const devPlus = usePurchasesStore((s) => s.entitlement.active) || !!relationship?.dev_plus;
  // On the server too (so restoring a streak, AI games and every limit really unlock), for
  // accounts in the server's DEV_TOOLS_USER_IDS; otherwise only this phone pretends.
  const setDevPlus = (on: boolean) => {
    usePurchasesStore.setState((s) => ({ entitlement: { ...s.entitlement, active: on, trial: false } }));
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        await setDevPlus_(token, on);
        if (relationship) setRelationship({ ...relationship, dev_plus: on ? 1 : 0 });
      } catch (e) {
        Alert.alert(
          'Only on this phone',
          `${e instanceof Error ? e.message : 'The server didn’t switch Plus on.'}

Until then, Plus features the server checks (restoring a streak, AI games, the moment limit) stay locked.`,
        );
      }
    })();
  };
  const [savingBirthday, setSavingBirthday] = useState(false);
  const [showRelationshipTypeModal, setShowRelationshipTypeModal] = useState(false);
  const [relationshipTypeDraft, setRelationshipTypeDraft] = useState<RelationshipType | null>(
    relationship?.relationship_type ?? null,
  );
  const [savingRelationshipType, setSavingRelationshipType] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<PendingEmailAddress | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [verifyingEmailCode, setVerifyingEmailCode] = useState(false);

  const [anniversaryOpen, setAnniversaryOpen] = useState(false);
  // Developer: one feature on its own (the Home header, streak alerts).
  const [designPreview, setDesignPreview] = useState<DesignPreviewKind | null>(null);
  /**
   * Developer: a call screen with no real call (a "preview-…" id), ringing or already
   * connected. Minimise it, leave the app (the "Ongoing call" notification) or end it.
   */
  const previewCall = (mode: 'audio' | 'video', connected: boolean) => {
    const calls = useCallStore.getState();
    calls.reset();
    calls.setIncoming({
      callId: `preview-${mode}`,
      mode,
      partnerName: getFirstName(partner?.name) ?? 'Your person',
    });
    if (connected) calls.setPhase('active');
  };
  const hapticsOn = useHapticsPref((s) => s.enabled);
  const setHapticsOn = useHapticsPref((s) => s.setEnabled);

  const openAccountOptions = () => {
    const hasSpace = !!relationship && relationship.status !== 'ended';
    askChoice({ title: 'Account options', actions: [
...(hasSpace ? [{ label: 'End shared space', onPress: handleLeaveRelationship }] : []),
{ label: 'Delete account', destructive: true, onPress: handleDeleteAccount },
] });
  };

  const showWidgetHelp = () => {
    Alert.alert(
      'Add a Moments widget',
      'Touch and hold an empty spot on your Home Screen until the apps jiggle, tap Edit, then Add Widget, and search for Moments.',
    );
  };

  const openLink = (url: string) => {
    void Linking.openURL(url).catch(() => Alert.alert('Couldn’t open link', 'Please try again later.'));
  };

  const contactSupport = (subject: string) => {
    const version = Constants.expoConfig?.version ?? '';
    openLink(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`${subject} (Moments ${version})`)}`);
  };
  const [savingAnniversary, setSavingAnniversary] = useState(false);

  const waitingForPartner = !!relationship && !partner;
  const anniversaryIso = relationship?.created_at ? getRelationshipAnniversaryIso(relationship) : null;

  const saveAnniversary = async (isoDate: string) => {
    if (!relationship) return;
    if (!isValidAnniversaryIso(isoDate)) {
      Alert.alert('Invalid date', 'Please pick a valid anniversary date.');
      return;
    }
    setSavingAnniversary(true);
    try {
      const updated = await api.updateRelationshipAnniversary(relationship.id, isoDate);
      setRelationship(updated);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setAnniversaryOpen(false);
      Alert.alert('Anniversary updated');
    } catch (e) {
      Alert.alert('Could not save', toUserFacingNetworkError(e, 'Please try again.').message);
    } finally {
      setSavingAnniversary(false);
    }
  };

  const handleLogout = () => {
    void (async () => {
      await signOutUser();
      router.replace('/(auth)/login');
    })();
  };

  // Really deletes (App Store 5.1.1(v)): the server removes the shared space,
  // all data and media and the sign-in, then we sign out locally.
  const handleDeleteAccount = () => {
    // Paying for Plus: deleting the account can't cancel an App Store / Google Play
    // subscription, and it would keep charging. Say so first, with a way to cancel.
    if (isPlus && isOwner) {
      askChoice({ title: 'Cancel your subscription first', message: 'You pay for Moments Plus. Deleting your account doesn’t cancel it, so you’d keep being charged. Cancel it in your subscriptions first.', cancelLabel: 'Not now', actions: [
{ label: 'Manage subscription', onPress: () => void openSubscriptionManagement().catch(() => undefined) },
{ label: 'Delete anyway', destructive: true, onPress: confirmDeleteAccount },
] });
      return;
    }
    confirmDeleteAccount();
  };

  const confirmDeleteAccount = () => {
    const space = relationship
      ? ' Your shared space closes for both of you, with its moments, chats and memories.'
      : '';
    askChoice({ title: 'Delete your account?', message: `This permanently deletes your account, photos and messages.${space} This can’t be undone.`, actions: [
{ label: 'Delete forever', destructive: true, onPress: async () => {
            try {
              const token = await getToken();
              if (!token) throw new Error('Please sign in again, then try.');
              await deleteMyAccount(token);
            } catch (e) {
              Alert.alert('Couldn’t delete your account', e instanceof Error ? e.message : 'Please try again.');
              return;
            }
            // The account is gone; signing out can fail on a dead session, which is fine.
            await signOutUser().catch(() => undefined);
            router.replace('/(auth)/welcome');
          } },
] });
  };

  const handleLeaveRelationship = () => {
    if (!relationship || !user) return;

    let message = partner
      ? `You'll disconnect from ${partner.name}. Your shared space will close for both of you, but your account stays. You can create or join a new space anytime.`
      : waitingForPartner
        ? "You'll close this empty space. Your account stays. Then enter your partner's invite code on the next screen, or go to You, then Join partner's space."
        : "You'll close this relationship space. Your account stays, and you can create or join a new one anytime.";

    if (isPlus) {
      if (isOwner) {
        message += plusExpiryLabel
          ? ` You keep Moments Plus until ${plusExpiryLabel}. Your partner will lose Plus when this space closes.`
          : ' You keep Moments Plus until your subscription ends. Your partner will lose Plus when this space closes.';
      } else {
        message += " You'll lose Moments Plus. Your partner keeps their subscription until it ends.";
      }
    }

    askChoice({ title: 'End your shared space?', message: message, cancelLabel: 'Stay', actions: [
{ label: 'End space', destructive: true, onPress: async () => {
          try {
            await api.leaveRelationship(user.id, relationship.id);
            await markRelationshipOnboardingDone(user.id);
            // Still signed in: the old space's data goes, and the launch screen sends you to
            // making a new space or joining one (it used to sign you out as well).
            const { queryClient } = await import('@/providers/AppProviders');
            queryClient.clear();
            useRelationshipStore.getState().reset();
            router.replace('/');
          } catch (e) {
            Alert.alert('Could not end the space', e instanceof Error ? e.message : 'Please try again.');
          }
        } },
] });
  };

  const openEdit = (field: 'name' | 'space' | 'email', current: string) => {
    setEditField(field);
    setEditDraft(current);
  };

  const closeEdit = () => {
    setEditField(null);
    setEditDraft('');
  };

  const saveEdit = async () => {
    const trimmed = editDraft.trim();
    if (!trimmed || !editField) return;

    setSavingEdit(true);
    try {
      if (editField === 'name' && user) {
        const updated = await api.updateProfile(user.id, { name: trimmed });
        setUser(updated);
        closeEdit();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Name updated');
        return;
      } else if (editField === 'space' && relationship) {
        const updated = await api.updateRelationship(relationship.id, { relationship_name: trimmed });
        setRelationship(updated);
        closeEdit();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Space name updated');
        return;
      } else if (editField === 'email' && user && clerkUser) {
        const emailAddress = await clerkUser.createEmailAddress({ email: trimmed });
        await emailAddress.prepareVerification({ strategy: 'email_code' });
        closeEdit();
        setTimeout(() => setPendingEmail(emailAddress), 320);
        return;
      }
      closeEdit();
    } catch (e) {
      Alert.alert('Could not save', formatAuthError(e));
    } finally {
      setSavingEdit(false);
    }
  };

  const closeEmailCodeModal = () => {
    setPendingEmail(null);
    setEmailCode('');
  };

  const verifyEmailCode = async () => {
    if (!pendingEmail || !user || !clerkUser || emailCode.length !== 6) return;

    setVerifyingEmailCode(true);
    try {
      const verified = await pendingEmail.attemptVerification({ code: emailCode });
      await clerkUser.update({ primaryEmailAddressId: verified.id });
      // The old address goes, so it can't still be used to sign in or reset the password.
      await Promise.all(
        clerkUser.emailAddresses
          .filter((e) => e.id !== verified.id)
          .map((e) => e.destroy().catch(() => undefined)),
      );
      // The server takes the new address from the sign-in itself, never from the app.
      const token = await getToken();
      if (!token) throw new Error('Please sign in again, then try.');
      const updated = await syncMyEmail(token);
      setUser(updated);
      closeEmailCodeModal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Email updated');
    } catch (e) {
      Alert.alert('Could not verify code', formatAuthError(e));
    } finally {
      setVerifyingEmailCode(false);
    }
  };

  const changeProfilePhoto = async () => {
    if (!user) return;
    if (!(await ensurePermission('photos'))) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;

    setAvatarSaving(true);
    try {
      const avatarUrl = await api.uploadProfileAvatar(user.id, result.assets[0].uri);
      const updated = await api.updateProfile(user.id, { avatar_url: avatarUrl });
      setUser(updated);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Photo updated');
    } catch (e) {
      Alert.alert('Could not update photo', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setAvatarSaving(false);
    }
  };

  const openPasswordModal = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPasswordModal(true);
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const savePassword = async () => {
    if (!clerkUser) return;
    // Apple / Google sign-ups have no password yet: they set a first one, no current one needed.
    const settingFirst = !clerkUser.passwordEnabled;
    if (
      (!settingFirst && !currentPassword) ||
      newPassword.length < MIN_PASSWORD_LENGTH ||
      newPassword !== confirmPassword ||
      (!settingFirst && newPassword === currentPassword)
    ) {
      return;
    }

    setSavingPassword(true);
    try {
      await clerkUser.updatePassword(settingFirst ? { newPassword } : { currentPassword, newPassword });
      closePasswordModal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Password updated', 'Your new password is ready to use next time you sign in.');
    } catch (e) {
      Alert.alert('Could not update password', formatAuthError(e));
    } finally {
      setSavingPassword(false);
    }
  };

  const openGenderModal = () => {
    setGenderDraft(profileGender(user));
    setShowGenderModal(true);
  };

  const closeGenderModal = () => {
    setShowGenderModal(false);
    setGenderDraft(profileGender(user));
  };

  const saveGender = async (gender: ProfileGender) => {
    if (!user) return;
    setGenderDraft(gender);
    setSavingGender(true);
    try {
      const updated = await api.updateProfile(user.id, { gender_identity: gender });
      setUser(updated);
      closeGenderModal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSavingGender(false);
    }
  };

  const saveBirthday = async (isoDate: string) => {
    if (!user) return;
    if (!isOldEnough(isoDate)) {
      Alert.alert(`Moments is for ${MIN_AGE} and over`, 'Check the date and try again.');
      return;
    }
    setSavingBirthday(true);
    try {
      const updated = await api.updateProfile(user.id, { birthday: isoDate });
      setUser(updated);
      setBirthdayOpen(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSavingBirthday(false);
    }
  };

  const openRelationshipTypeModal = () => {
    setRelationshipTypeDraft(relationship?.relationship_type ?? null);
    setShowRelationshipTypeModal(true);
  };

  const closeRelationshipTypeModal = () => {
    setShowRelationshipTypeModal(false);
    setRelationshipTypeDraft(relationship?.relationship_type ?? null);
  };

  const saveRelationshipType = async (relationshipType: RelationshipType) => {
    if (!relationship) return;

    setRelationshipTypeDraft(relationshipType);
    setSavingRelationshipType(true);
    try {
      const updated = await api.updateRelationship(relationship.id, {
        relationship_type: relationshipType,
      });
      setRelationship(updated);
      closeRelationshipTypeModal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Relationship type updated');
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSavingRelationshipType(false);
    }
  };

  const editModalTitle = editField === 'name' ? 'Name' : editField === 'space' ? 'Space name' : 'Email';
  const editModalLabel =
    editField === 'name'
      ? 'This is how your partner sees you.'
      : editField === 'space'
        ? 'The name of your shared space. You both see it on Home.'
        : 'We’ll send a 6-digit code to the new address to confirm it’s yours.';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Settings" onBack={() => closeStackScreen(router)} />

      <ScrollView
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 16 }]}>
        {/* Profile photo only — name and email live in Account below. */}
        <Pressable
          onPress={changeProfilePhoto}
          disabled={avatarSaving}
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          style={({ pressed }) => [styles.card, styles.meCard, cardSurface, pressed && styles.pressed]}>
          <View>
            <Avatar name={user?.name} imageUrl={user?.avatar_url} size={60} />
            <View style={[styles.cameraBadge, { backgroundColor: colors.accent, borderColor: colors.surface }]}>
              {avatarSaving ? (
                <ActivityIndicator size="small" color={colors.onAccent} />
              ) : (
                <Icon name="camera" size={13} color={colors.onAccent} />
              )}
            </View>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.meName, { color: colors.text }]}>
              {avatarSaving ? 'Updating photo…' : 'Profile photo'}
            </Text>
            <Text style={[styles.meEmail, { color: colors.textSecondary }]}>Tap to change</Text>
          </View>
          <Icon name="chevronRight" size={16} color={colors.textTertiary} />
        </Pressable>

        <Section title="Account">
          <Group>
            <Row icon="user" label="Name" value={user?.name?.trim() || 'Add your name'} onPress={() => openEdit('name', user?.name ?? '')} />
            <Row icon="people" label="Gender" value={profileGenderLabel(profileGender(user))} onPress={openGenderModal} />
            <Row
              icon="gift"
              label="Birthday"
              value={user?.birthday ? birthdayShortLabel(user.birthday) : 'Add your birthday'}
              onPress={() => setBirthdayOpen(true)}
            />
            <Row icon="mail" label="Email" value={user?.email ?? ''} onPress={() => openEdit('email', user?.email ?? '')} />
            <Row
              icon="lock"
              label="Password"
              value={clerkUser && !clerkUser.passwordEnabled ? 'Not set' : '••••••••'}
              onPress={openPasswordModal}
            />
            <Row icon="settings" label="Account options" onPress={openAccountOptions} last />
          </Group>
        </Section>

        {relationship && relationship.status !== 'ended' ? (
          <Section title="Relationship">
            <Group>
              <Row
                icon="heart"
                label="Space name"
                value={relationship.relationship_name?.trim() || 'Our Moments'}
                onPress={() => openEdit('space', relationship.relationship_name ?? '')}
              />
              <Row
                icon="compass"
                label="Relationship type"
                value={relationshipTypeLabel(relationship.relationship_type)}
                onPress={openRelationshipTypeModal}
              />
              <Row
                icon="calendar"
                label="Anniversary"
                value={anniversaryIso ? format(parseISO(anniversaryIso), 'd MMM yyyy') : 'Add date'}
                onPress={() => setAnniversaryOpen(true)}
                last
              />
            </Group>
          </Section>
        ) : null}

        <Section title="Preferences">
          <Group>
            <Row
              icon="bell"
              label="Notifications"
              onPress={() => router.push('/notification-settings')}
              last={Platform.OS !== 'ios'}
            />
            {/* Moments widgets are iPhone only for now. */}
            {Platform.OS === 'ios' ? <Row icon="phone" label="Widget" onPress={showWidgetHelp} last /> : null}
            <SettingsToggleDivider />
            <SettingsToggleRow
              icon="haptics"
              title="Haptics"
              subtitle={hapticsOn ? 'Gentle vibrations when you tap and send' : 'No vibrations anywhere in the app'}
              value={hapticsOn}
              onChange={setHapticsOn}
            />
          </Group>
          <Text style={[styles.subheading, { color: colors.textSecondary }]}>Appearance</Text>
          <View style={[styles.card, styles.themeCard, cardSurface]}>
            {THEME_META.map((t) => (
              <ThemePreview key={t.key} themeKey={t.key} label={t.label} active={theme === t.key} onPress={() => setTheme(t.key)} />
            ))}
            {THEME_GRID_FILLERS.map((k) => (
              <View key={k} style={styles.themeItem} />
            ))}
          </View>
          <AppIconPicker />
        </Section>

        <Section title="Privacy">
          <Group>
            <OnlineStatusSettings />
            <View style={[styles.divider, { backgroundColor: separatorColor(colors) }]} />
            <LocationSharingSettings />
          </Group>
        </Section>

        <Section title="Moments Plus">
          <Group>
            <Row
              icon="diamond"
              label="Your plan"
              value={
                isPlus
                  ? relationship?.subscription_period === 'grace' && isOwner
                    ? 'Plus · payment issue'
                    : isOwner
                      ? 'Plus'
                      : `Plus · via ${getFirstName(partner?.name) ?? 'partner'}`
                  : 'Free'
              }
              onPress={openPlan}
            />
            <Row
              icon="gift"
              label="Invite a couple"
              value={`${REFERRAL_DAYS} days free`}
              onPress={() => router.push('/refer')}
            />
            <Row
              icon="restore"
              label="Restore purchases"
              onPress={() => void restorePlan()}
              last
            />
          </Group>
        </Section>

        <Section title="Help & support">
          <Group>
            <Row icon="help" label="Contact support" onPress={() => contactSupport('Help with Moments')} />
            <Row icon="flag" label="Report a problem" onPress={() => contactSupport('Problem report')} />
            <Row icon="star" label="Rate Moments" onPress={() => useUIStore.setState({ showRatingPage: true })} />
            <Row icon="mail" label="Send feedback" onPress={() => contactSupport('Feedback')} />
            <Row icon="lock" label="Privacy policy" onPress={() => router.push('/legal/privacy')} />
            <Row icon="document" label="Terms of service" onPress={() => router.push('/legal/terms')} last />
          </Group>
        </Section>

        <Section title="Follow us">
          <Group>
            {SOCIAL_LINKS.map((link, i) => (
              <Row
                key={link.key}
                icon={link.icon}
                label={link.label}
                onPress={() => openLink(link.url)}
                last={i === SOCIAL_LINKS.length - 1}
              />
            ))}
          </Group>
        </Section>

        {__DEV__ ? (
          <Section title="Developer">
            <Group>
              <Row
                icon="play"
                label="Walk through onboarding"
                onPress={() => {
                  useUIStore.setState({ devPreview: true });
                  router.push({ pathname: '/(onboarding)/about-you', params: { preview: '1' } });
                }}
              />
              <Row
                icon="lock"
                label="Preview sign-in screens"
                onPress={() => {
                  useUIStore.setState({ authPreview: true });
                  router.push('/(auth)/welcome');
                }}
              />
              <Row
                icon="compass"
                label="Preview app tour"
                onPress={() => {
                  // The tour points at Home, so go there first.
                  router.navigate('/(tabs)/home');
                  setTimeout(() => useUIStore.getState().requestTour(), 600);
                }}
              />
              <Row
                icon="star"
                label="Preview rating page"
                onPress={() => useUIStore.setState({ showRatingPage: true })}
              />
              <Row
                icon="bell"
                label="Preview Dynamic Island"
                onPress={() =>
                  notifyIsland({
                    title: getFirstName(partner?.name) ?? 'Your person',
                    // Short and to the point, like the real ones.
                    message: 'Sent you a moment from your coffee spot',
                    icon: 'camera',
                    avatar: partner?.avatar_url ?? null,
                    avatarName: partner?.name ?? 'Partner',
                  })
                }
              />
              <Row
                icon="bell"
                label="Send a test notification (in 5s)"
                onPress={() => void sendTestNotification(getFirstName(partner?.name) ?? 'Your person')}
              />
              <Row
                icon="home"
                label="Preview widgets"
                onPress={() => {
                  useUIStore.setState({ devPreview: true });
                  router.push({ pathname: '/(onboarding)/widget-prompt', params: { preview: '1' } });
                }}
              />
              <Row
                icon="call"
                label="Preview voice call"
                onPress={() =>
                  useCallStore.getState().setIncoming({
                    callId: 'preview-voice',
                    mode: 'audio',
                    partnerName: getFirstName(partner?.name) ?? 'Your person',
                  })
                }
              />
              <Row
                icon="videocam"
                label="Preview video call"
                onPress={() =>
                  useCallStore.getState().setIncoming({
                    callId: 'preview-video',
                    mode: 'video',
                    partnerName: getFirstName(partner?.name) ?? 'Your person',
                  })
                }
              />
              <Row
                icon="call"
                label="Preview voice call (in call)"
                onPress={() => previewCall('audio', true)}
              />
              <Row
                icon="videocam"
                label="Preview video call (in call)"
                onPress={() => previewCall('video', true)}
              />
              <Row
                icon="call"
                label="Preview calling them (ringing)"
                onPress={() => {
                  // As when you start a call: ringing, then they pick up.
                  const calls = useCallStore.getState();
                  calls.reset();
                  calls.setMode('audio');
                  useCallStore.setState({
                    callId: 'preview-audio',
                    partnerName: getFirstName(partner?.name) ?? 'Your person',
                  });
                  calls.setPhase('outgoing');
                  setTimeout(() => {
                    if (useCallStore.getState().phase === 'outgoing') useCallStore.getState().setPhase('active');
                  }, 3500);
                }}
              />
              <Row
                icon="videocam"
                label="Preview: they turn on their camera"
                onPress={() => {
                  // In a voice call preview: what you see when your partner turns theirs on.
                  previewCall('audio', true);
                  setTimeout(() => useCallStore.getState().setPartnerCamera(true), 1500);
                }}
              />
              <Row
                icon="chevronDown"
                label="Preview minimised call"
                onPress={() => {
                  previewCall('audio', true);
                  useCallStore.getState().setMinimized(true);
                }}
              />
              <Row
                icon="unlock"
                label="Pretend Plus is on"
                onPress={() => setDevPlus(!devPlus)}
                right={<AppSwitch value={devPlus} onValueChange={setDevPlus} />}
              />
              <Row
                icon="gamepad"
                label="Open Endless games"
                onPress={() => router.navigate({ pathname: '/(tabs)/activities', params: { tab: 'endless' } })}
              />
              <Row
                icon="fire"
                label="Preview streak celebration"
                onPress={() => useUIStore.getState().openStreakSpark(42, 41)}
              />
              <Row
                icon="star"
                label="Preview milestone celebration"
                onPress={() => useUIStore.getState().openStreakMilestone(50)}
              />
              <Row
                icon="gift"
                label="Preview partner's birthday"
                onPress={() =>
                  useUIStore.setState({ birthdayCelebration: { kind: 'today', whose: 'partner', preview: true } })
                }
              />
              <Row
                icon="gift"
                label="Preview your birthday"
                onPress={() => useUIStore.setState({ birthdayCelebration: { kind: 'today', whose: 'me', preview: true } })}
              />
              <Row
                icon="calendar"
                label="Preview birthday reminder (day before)"
                onPress={() =>
                  useUIStore.setState({ birthdayCelebration: { kind: 'eve', whose: 'partner', preview: true } })
                }
              />
              <Row
                icon="bell"
                label="Preview birthday notification (in 5s)"
                onPress={() => void sendTestNotification(getFirstName(partner?.name) ?? 'Your person', 'birthday')}
              />
              <Row icon="sunny" label="Preview Home header (day and night)" onPress={() => setDesignPreview('header')} />
              <Row icon="fire" label="Preview streak at risk and restore" onPress={() => setDesignPreview('streak')} />
              <Row icon="gift" label="Preview birthday cards on Home" onPress={() => setDesignPreview('birthday')} />
              <Row
                icon="bell"
                label="Send the streak alerts (5s, 10s, 15s)"
                onPress={() => void sendTestNotification(getFirstName(partner?.name) ?? 'Your person', 'streak')}
              />
              <Row
                icon="calendar"
                label="Preview onboarding birthday step"
                onPress={() => {
                  useUIStore.setState({ devPreview: true });
                  router.push({ pathname: '/(onboarding)/birthday', params: { preview: '1' } });
                }}
                last
              />
            </Group>
          </Section>
        ) : null}

        <Pressable
          onPress={handleLogout}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, styles.signOut, cardSurface, pressed && styles.pressed]}>
          <Icon name="logout" size={20} color={colors.text} />
          <Text style={[styles.signOutText, { color: colors.text }]}>Sign out</Text>
        </Pressable>

        <Text style={[styles.footer, { color: colors.textTertiary }]}>
          Moments {Constants.expoConfig?.version ?? ''} · Closer, every day
        </Text>

      </ScrollView>

      <DesignPreviewModal kind={designPreview} onClose={() => setDesignPreview(null)} />

      <EditFieldModal
        visible={editField !== null}
        title={editModalTitle}
        label={editModalLabel}
        value={editDraft}
        placeholder={editField === 'email' ? 'you@example.com' : editField === 'space' ? 'Our little world' : 'Your name'}
        keyboardType={editField === 'email' ? 'email-address' : 'default'}
        autoCapitalize={editField === 'email' ? 'none' : 'words'}
        // The same limits as onboarding (name) and the space-name step.
        maxLength={editField === 'email' ? 254 : 32}
        saving={savingEdit}
        onChange={setEditDraft}
        onClose={closeEdit}
        onSave={saveEdit}
      />

      <VerifyEmailCodeModal
        visible={pendingEmail !== null}
        email={pendingEmail?.emailAddress ?? ''}
        code={emailCode}
        saving={verifyingEmailCode}
        onChangeCode={setEmailCode}
        onClose={closeEmailCodeModal}
        onSave={verifyEmailCode}
      />

      <ChangePasswordModal
        visible={showPasswordModal}
        settingFirst={!!clerkUser && !clerkUser.passwordEnabled}
        saving={savingPassword}
        currentPassword={currentPassword}
        newPassword={newPassword}
        confirmPassword={confirmPassword}
        onChangeCurrent={setCurrentPassword}
        onChangeNew={setNewPassword}
        onChangeConfirm={setConfirmPassword}
        onClose={closePasswordModal}
        onSave={savePassword}
      />

      <EditGenderModal
        visible={showGenderModal}
        value={profileGender(user)}
        savingValue={savingGender ? genderDraft : null}
        onSelect={(g) => void saveGender(g)}
        onClose={closeGenderModal}
      />

      <EditAnniversaryModal
        visible={birthdayOpen}
        value={user?.birthday ?? '2000-01-01'}
        saving={savingBirthday}
        onClose={() => setBirthdayOpen(false)}
        onSave={(iso) => void saveBirthday(iso)}
        title="Birthday"
        hint="Only your person sees it. They get a countdown and a reminder so they never forget."
        minYear={1920}
        maxYear={latestBirthYear()}
      />

      <EditRelationshipTypeModal
        visible={showRelationshipTypeModal}
        value={relationship?.relationship_type}
        savingValue={savingRelationshipType ? relationshipTypeDraft : null}
        onSelect={(t) => void saveRelationshipType(t)}
        onClose={closeRelationshipTypeModal}
      />

      {anniversaryIso ? (
        <EditAnniversaryModal
          visible={anniversaryOpen}
          value={anniversaryIso}
          saving={savingAnniversary}
          onClose={() => setAnniversaryOpen(false)}
          onSave={saveAnniversary}
        />
      ) : null}
    </View>
  );
}

/**
 * Developer: a real system notification a few seconds from now, so you can leave the
 * app and see it on the lock screen / as a banner. Tapping it opens the moment flow.
 */
async function sendTestNotification(partnerName: string, kind: 'moment' | 'birthday' | 'streak' = 'moment') {
  const Notifications = loadExpoNotifications();
  if (!Notifications) {
    Alert.alert('Not available here', 'System notifications need a development build (not Expo Go).');
    return;
  }
  try {
    let { granted } = await Notifications.getPermissionsAsync();
    if (!granted) granted = (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) {
      Alert.alert('Notifications are off', 'Turn them on for Moments in your phone’s Settings, then try again.');
      return;
    }
    if (kind === 'streak') {
      // The three streak alerts, with the same words as lib/streak-reminders (on a 12-day streak).
      const alerts = [
        { title: 'Streak at risk', body: 'Your 12 day streak ends in 3 hours. Check in to keep it going.', kind: 'warn' },
        { title: 'Last chance', body: 'Your 12 day streak ends in 1 hour. Check in before midnight.', kind: 'nudge' },
        { title: 'Streak ended', body: 'Your 12 day streak ended. Check in today to start a new one.', kind: 'ended' },
      ];
      for (const [i, a] of alerts.entries()) {
        await Notifications.scheduleNotificationAsync({
          content: { title: a.title, body: a.body, data: { type: 'streak', kind: a.kind }, sound: true },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 * (i + 1) },
        });
      }
      Alert.alert('Sending 3 alerts', 'At 5, 10 and 15 seconds. Leave the app (or lock your phone) to see them.');
      return;
    }
    await Notifications.scheduleNotificationAsync({
      // The same words the server sends (see the birthday heads-up in server/src/birthdays.ts).
      content:
        kind === 'birthday'
          ? {
              title: 'Birthday tomorrow',
              body: `${partnerName}’s birthday is tomorrow 🎂 Plan something special.`,
              data: { type: 'birthday' },
              sound: true,
            }
          : {
              title: `${partnerName} sent you a moment`,
              body: 'Tap to see it before it’s gone.',
              data: { type: 'moment' },
              sound: true,
            },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
    });
    Alert.alert('Sent in 5 seconds', 'Leave the app (or lock your phone) to see it arrive.');
  } catch (e) {
    Alert.alert('Couldn’t schedule it', e instanceof Error ? e.message : 'Please try again.');
  }
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function Group({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return <View style={[styles.card, styles.group, surfaceStyle(colors)]}>{children}</View>;
}

/**
 * A card's fill, plus the theme's border where the theme draws cards with one
 * (Paper's cards are white on a white page, so the border is the card).
 */
/** Icon tiles: a step off the card (Paper's surfaces are all white). */
function tileColor(colors: ThemeColors) {
  if (colors.boldBorder) return colors.backgroundElevated;
  // Soft light themes: a white tile on the tinted card reads cleanest.
  if (colors.sticker && !colors.isDark) return colors.background;
  return colors.surfaceElevated;
}

function surfaceStyle(colors: ThemeColors) {
  return {
    backgroundColor: colors.surface,
    // Soft themes: a crisp 1pt edge instead of Paper's 2pt line.
    borderWidth: colors.boldBorder ? 2 : colors.sticker ? 1 : 0,
    borderColor: colors.border,
  };
}

/** A settings row: icon tile, label, current value, chevron. Dividers start at the label. */
function Row({
  icon,
  label,
  value,
  onPress,
  danger,
  muted,
  right,
  last,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  /** Low-emphasis label for rows that shouldn't draw the eye. */
  muted?: boolean;
  /** Replaces the chevron (e.g. a switch). */
  right?: ReactNode;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const tint = danger ? colors.error : muted ? colors.textSecondary : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceElevated }]}>
      <View style={[styles.tile, { backgroundColor: danger ? colorWithAlpha(colors.error, 0.14) : tileColor(colors) }]}>
        <Icon name={icon} size={19} color={tint} />
      </View>
      <View
        style={[
          styles.rowBody,
          !last && { borderBottomWidth: 1, borderBottomColor: separatorColor(colors) },
        ]}>
        <Text style={[styles.rowLabel, { color: tint }]} numberOfLines={1}>
          {label}
        </Text>
        {value ? (
          <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {right ?? <Icon name="chevronRight" size={16} color={colors.textTertiary} />}
      </View>
    </Pressable>
  );
}

/** A tiny mock of the app in that theme: its gradient, then a few cards. */
function ThemePreview({
  themeKey,
  label,
  active,
  onPress,
}: {
  themeKey: AppTheme;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const t = Themes[themeKey];
  return (
    <Pressable
      onPress={onPress}
      style={styles.themeItem}
      accessibilityRole="button"
      accessibilityLabel={`${label} theme`}
      accessibilityState={{ selected: active }}>
      <View
        style={[
          styles.themeMock,
          { backgroundColor: t.background },
          active ? { borderColor: colors.accent, borderWidth: 2.5 } : { borderColor: colors.border, borderWidth: 1 },
        ]}>
        <LinearGradient colors={t.hero ?? t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mockHero} />
        <View style={[styles.mockLine, { backgroundColor: t.surface }]} />
        <View style={[styles.mockLine, styles.mockShort, { backgroundColor: t.surface }]} />
        <View style={[styles.mockLine, { backgroundColor: t.surface }]} />
        {active ? (
          <View style={[styles.themeTick, { backgroundColor: colors.accent }]}>
            <Icon name="check" size={12} color={colors.onAccent} />
          </View>
        ) : null}
      </View>
      <Text style={[styles.themeLabel, { color: active ? colors.text : colors.textSecondary }, active && styles.themeLabelActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.7 },
  // Same rhythm as Home: 24 between sections, 10 from a heading to its card.
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs, gap: 24 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  subheading: { fontSize: 15, fontWeight: '700', marginTop: 6, paddingHorizontal: 4 },
  card: { borderRadius: 22 },
  group: { overflow: 'hidden', paddingVertical: 2 },

  meCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  cameraBadge: {
    position: 'absolute',
    right: -4,
    bottom: -4,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meName: { fontSize: 17, fontWeight: '800' },
  meEmail: { fontSize: 14, marginTop: 2 },

  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 },
  tile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowBody: {
    flex: 1,
    minHeight: 56,
    marginLeft: 12,
    paddingRight: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  rowValue: { maxWidth: '55%', fontSize: 14 },
  divider: { height: 1, marginLeft: 60 },

  // Three a row, two rows.
  themeCard: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 16, padding: 14 },
  themeItem: { width: '31%', flexGrow: 1, alignItems: 'center', gap: 8 },
  themeMock: { alignSelf: 'stretch', height: 118, borderRadius: 18, padding: 10, gap: 6, overflow: 'hidden' },
  mockHero: { height: 34, borderRadius: 9 },
  mockLine: { height: 14, borderRadius: 5 },
  mockShort: { width: '70%' },
  themeTick: {
    position: 'absolute',
    right: 6,
    top: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeLabel: { fontSize: 14, fontWeight: '600' },
  themeLabelActive: { fontWeight: '800' },

  signOut: { height: 54, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  signOutText: { fontSize: 16, fontWeight: '800' },
  footer: { fontSize: 12, textAlign: 'center' },
});
