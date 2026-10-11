import { useUser } from '@clerk/expo';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChangePasswordModal } from '@/components/profile/ChangePasswordModal';
import { EditFieldModal } from '@/components/profile/EditFieldModal';
import { EditGenderModal } from '@/components/profile/EditGenderModal';
import { EditRelationshipTypeModal } from '@/components/profile/EditRelationshipTypeModal';
import { LocationSharingSettings } from '@/components/profile/LocationSharingSettings';
import { OnlineStatusSettings } from '@/components/profile/OnlineStatusSettings';
import { VerifyEmailCodeModal } from '@/components/profile/VerifyEmailCodeModal';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar, Card, SectionTitle } from '@/components/ui/primitives';
import { THEME_META, Radius, Spacing } from '@/constants/design-system';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { formatAuthError } from '@/lib/auth-errors';
import { signOutUser } from '@/lib/auth-session';
import { markRelationshipOnboardingDone } from '@/lib/onboarding-storage';
import { profileGenderLabel } from '@/lib/profile-gender';
import { relationshipTypeLabel } from '@/lib/relationship-type';
import { closeStackScreen } from '@/lib/router';
import { requestStoreReviewFromSettings } from '@/lib/store-review';
import { formatSubscriptionExpiry } from '@/lib/subscription';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { ProfileGender, RelationshipType } from '@/types/database';

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
  const relationship = useRelationshipStore((s) => s.relationship);
  const setRelationship = useRelationshipStore((s) => s.setRelationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { user: clerkUser } = useUser();
  const { isPlus, isOwner } = useSubscription();
  const plusExpiryLabel = formatSubscriptionExpiry(user?.subscription_expires_at);

  const [editField, setEditField] = useState<'name' | 'space' | 'email' | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [genderDraft, setGenderDraft] = useState<ProfileGender | null>(user?.gender ?? null);
  const [savingGender, setSavingGender] = useState(false);
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

  const waitingForPartner = !!relationship && !partner;

  const handleLogout = () => {
    void (async () => {
      await signOutUser();
      router.replace('/(auth)/login');
    })();
  };

  const handleDeleteAccount = () => {
    Alert.alert('Delete Account', 'This permanently removes your account and data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOutUser();
            router.replace('/(auth)/login');
          } catch (e) {
            Alert.alert('Sign out failed', e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);
  };

  const handleLeaveRelationship = () => {
    if (!relationship || !user) return;

    let message = partner
      ? `You'll disconnect from ${partner.name}. Your shared space will close for both of you, but your account stays. You can create or join a new space anytime.`
      : waitingForPartner
        ? "You'll close this empty space. Your account stays — then join your partner's invite code from the next screen (or You → Join partner's space)."
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

    Alert.alert('Leave relationship?', message, [
      { text: 'Stay', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.leaveRelationship(user.id, relationship.id);
            await markRelationshipOnboardingDone(user.id);
            await signOutUser();
            router.replace('/(auth)/login');
          } catch (e) {
            Alert.alert('Could not leave', e instanceof Error ? e.message : 'Please try again.');
          }
        },
      },
    ]);
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
      } else if (editField === 'space' && relationship) {
        const updated = await api.updateRelationship(relationship.id, { relationship_name: trimmed });
        setRelationship(updated);
      } else if (editField === 'email' && user && clerkUser) {
        const emailAddress = await clerkUser.createEmailAddress({ email: trimmed });
        await emailAddress.prepareVerification({ strategy: 'email_code' });
        setPendingEmail(emailAddress);
        closeEdit();
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
      const updated = await api.updateProfile(user.id, { email: verified.emailAddress });
      setUser(updated);
      closeEmailCodeModal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Could not verify code', formatAuthError(e));
    } finally {
      setVerifyingEmailCode(false);
    }
  };

  const changeProfilePhoto = async () => {
    if (!user) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to update your profile picture.');
      return;
    }
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
    if (
      !currentPassword ||
      newPassword.length < 6 ||
      newPassword !== confirmPassword ||
      newPassword === currentPassword
    ) {
      return;
    }
    if (!clerkUser) return;

    setSavingPassword(true);
    try {
      await clerkUser.updatePassword({ currentPassword, newPassword });
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
    setGenderDraft(user?.gender ?? null);
    setShowGenderModal(true);
  };

  const closeGenderModal = () => {
    setShowGenderModal(false);
    setGenderDraft(user?.gender ?? null);
  };

  const saveGender = async () => {
    if (!user || !genderDraft) return;

    setSavingGender(true);
    try {
      const updated = await api.updateProfile(user.id, { gender: genderDraft });
      setUser(updated);
      closeGenderModal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSavingGender(false);
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

  const saveRelationshipType = async () => {
    if (!relationship || !relationshipTypeDraft) return;

    setSavingRelationshipType(true);
    try {
      const updated = await api.updateRelationship(relationship.id, {
        relationship_type: relationshipTypeDraft,
      });
      setRelationship(updated);
      closeRelationshipTypeModal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSavingRelationshipType(false);
    }
  };

  const editModalTitle =
    editField === 'name' ? 'Display name' : editField === 'space' ? 'Space name' : 'Email address';
  const editModalLabel =
    editField === 'name'
      ? 'This is how your partner sees you'
      : editField === 'space'
        ? 'Your shared space name'
        : "We'll send a 6-digit code to the new address";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Settings" onBack={() => closeStackScreen(router)} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.xxl }]}>
        <View style={styles.sectionBlock}>
          <SectionTitle style={styles.sectionLabel}>Account</SectionTitle>
          <Card>
            <Pressable
              onPress={changeProfilePhoto}
              style={({ pressed }) => [styles.accountPhotoRow, pressed && { opacity: 0.6 }]}
              disabled={avatarSaving}
              accessibilityRole="button"
              accessibilityLabel="Change profile photo">
              <Avatar name={user?.name} imageUrl={user?.avatar_url} size={52} />
              <View style={styles.flex}>
                <Text style={[styles.settingTitle, { color: colors.text }]}>
                  {avatarSaving ? 'Updating photo…' : 'Profile photo'}
                </Text>
                <Text style={[styles.settingSub, { color: colors.textSecondary }]}>Tap to change</Text>
              </View>
              <Icon name="camera" size={20} color={colors.textSecondary} />
            </Pressable>
          </Card>
          <Card padded={false}>
            <SettingEditItem
              icon="user"
              label="Display name"
              value={user?.name?.trim() || 'Add your name'}
              onPress={() => openEdit('name', user?.name ?? '')}
            />
            <SettingEditItem
              icon="compass"
              label="Gender"
              value={profileGenderLabel(user?.gender)}
              onPress={openGenderModal}
            />
            <SettingEditItem
              icon="mail"
              label="Email"
              value={user?.email ?? ''}
              onPress={() => openEdit('email', user?.email ?? '')}
            />
            <SettingEditItem
              icon="lock"
              label="Password"
              value="Tap to change"
              onPress={openPasswordModal}
              last
            />
          </Card>
        </View>

        <View style={styles.sectionBlock}>
          <SectionTitle style={styles.sectionLabel}>Appearance</SectionTitle>
          <View style={styles.themeGrid}>
            {THEME_META.map((t) => {
              const active = theme === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => setTheme(t.key)}
                  style={styles.themeItem}
                  accessibilityRole="button"
                  accessibilityLabel={`${t.label} theme`}
                  accessibilityState={{ selected: active }}>
                  <View
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: t.swatch,
                        borderColor: active ? colors.accent : colors.border,
                        borderWidth: active ? 2.5 : 1,
                      },
                    ]}>
                    {active ? <Icon name="check" size={20} color={colors.accent} /> : null}
                  </View>
                  <Text style={[styles.themeLabel, { color: active ? colors.text : colors.textSecondary }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {relationship && relationship.status !== 'ended' ? (
          <View style={styles.sectionBlock}>
            <SectionTitle style={styles.sectionLabel}>Relationship</SectionTitle>
            <Card padded={false}>
              <SettingEditItem
                icon="heart"
                label="Space name"
                value={relationship.relationship_name?.trim() || 'Our Moments'}
                onPress={() => openEdit('space', relationship.relationship_name ?? '')}
              />
              <SettingEditItem
                icon="compass"
                label="Relationship type"
                value={relationshipTypeLabel(relationship.relationship_type)}
                onPress={openRelationshipTypeModal}
                last
              />
            </Card>
          </View>
        ) : null}

        <View style={styles.sectionBlock}>
          <SectionTitle style={styles.sectionLabel}>Privacy</SectionTitle>
          <Card padded={false}>
            <OnlineStatusSettings />
          </Card>
          <Card padded={false}>
            <LocationSharingSettings />
          </Card>
        </View>

        <View style={styles.sectionBlock}>
          <SectionTitle style={styles.sectionLabel}>Support</SectionTitle>
          <Card padded={false}>
            <SettingItem icon="star" label="Rate Moments" onPress={() => void requestStoreReviewFromSettings()} />
            <SettingItem icon="lock" label="Privacy Policy" onPress={() => router.push('/legal/privacy')} />
            <SettingItem icon="list" label="Terms of Service" onPress={() => router.push('/legal/terms')} last />
          </Card>
        </View>

        {/* Destructive and session actions last, set apart from everything above. */}
        <View style={styles.sectionBlock}>
          <Card padded={false}>
            <SettingItem icon="logout" label="Sign Out" tint={colors.accent} onPress={handleLogout} />
            {relationship && relationship.status !== 'ended' ? (
              <SettingItem
                icon="close"
                label="Leave relationship"
                tint={colors.error}
                onPress={handleLeaveRelationship}
              />
            ) : null}
            <SettingItem
              icon="trash"
              label="Delete Account"
              tint={colors.error}
              onPress={handleDeleteAccount}
              last
            />
          </Card>
        </View>

        <Text style={[styles.footer, { color: colors.textTertiary }]}>Moments · Closer, every day</Text>
      </ScrollView>

      <EditFieldModal
        visible={editField !== null}
        title={editModalTitle}
        label={editModalLabel}
        value={editDraft}
        placeholder={editField === 'email' ? 'you@example.com' : 'Enter a name'}
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
        value={genderDraft}
        saving={savingGender}
        onChange={setGenderDraft}
        onClose={closeGenderModal}
        onSave={saveGender}
      />

      <EditRelationshipTypeModal
        visible={showRelationshipTypeModal}
        value={relationshipTypeDraft}
        saving={savingRelationshipType}
        onChange={setRelationshipTypeDraft}
        onClose={closeRelationshipTypeModal}
        onSave={saveRelationshipType}
      />
    </View>
  );
}

function SettingEditItem({
  icon,
  label,
  value,
  onPress,
  last,
}: {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      style={({ pressed }) => [
        styles.settingRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && { opacity: 0.6 },
      ]}>
      <View style={styles.settingLeft}>
        <Icon name={icon} size={20} color={colors.textSecondary} />
        <View style={styles.flex}>
          <Text style={[styles.settingTitle, { color: colors.text }]}>{label}</Text>
          <Text style={[styles.settingSub, { color: colors.textSecondary }]} numberOfLines={1}>
            {value}
          </Text>
        </View>
      </View>
      <Icon name="chevronRight" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

function SettingItem({
  icon,
  label,
  onPress,
  tint,
  last,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  tint?: string;
  last?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.settingRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && { opacity: 0.6 },
      ]}>
      <View style={styles.settingLeft}>
        <Icon name={icon} size={20} color={tint ?? colors.textSecondary} />
        <Text style={[styles.settingTitle, { color: tint ?? colors.text }]}>{label}</Text>
      </View>
      <Icon name="chevronRight" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  // Same rhythm as the You tab: one gap between sections, 10 inside each.
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs, gap: 24 },
  sectionBlock: { gap: 10 },
  sectionLabel: { marginBottom: 0 },
  accountPhotoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  themeGrid: { flexDirection: 'row', justifyContent: 'center', gap: 28 },
  themeItem: { alignItems: 'center', gap: 8, width: 80 },
  themeLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
  swatch: { width: 72, height: 72, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: '600' },
  settingSub: { fontSize: 12, marginTop: 2 },
  footer: { fontSize: 12, textAlign: 'center' },
});
