import { formatDistanceToNow } from 'date-fns';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { ChangePasswordModal } from '@/components/profile/ChangePasswordModal';
import { EditFieldModal } from '@/components/profile/EditFieldModal';
import { EditGenderModal } from '@/components/profile/EditGenderModal';
import { EditRelationshipTypeModal } from '@/components/profile/EditRelationshipTypeModal';
import { LocationSharingSettings } from '@/components/profile/LocationSharingSettings';
import { OnlineStatusSettings } from '@/components/profile/OnlineStatusSettings';
import { ProfileAnniversarySection } from '@/components/profile/ProfileAnniversarySection';
import { ProfileCoupleLink } from '@/components/profile/ProfileCoupleLink';
import { Icon, type IconName } from '@/components/ui/Icon';
import { LogoMark } from '@/components/ui/Logo';
import { FullScreenImageModal } from '@/components/ui/FullScreenImageModal';
import { Avatar, Card, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import { THEME_META, Radius, Spacing } from '@/constants/design-system';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { getRelationshipAnniversaryDate } from '@/lib/anniversary';
import { getFirstName } from '@/lib/avatar-initial';
import { signOutUser } from '@/lib/auth-session';
import { markRelationshipOnboardingDone } from '@/lib/onboarding-storage';
import { profileGenderLabel } from '@/lib/profile-gender';
import { relationshipTypeLabel } from '@/lib/relationship-type';
import { requestStoreReviewFromSettings } from '@/lib/store-review';
import { formatSubscriptionExpiry } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type { ProfileGender, RelationshipType } from '@/types/database';

type AvatarPreview = {
  imageUrl: string | null | undefined;
  title: string;
  fallbackName: string | null | undefined;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, theme, setTheme } = useTheme();
  const relationship = useRelationshipStore((s) => s.relationship);
  const setRelationship = useRelationshipStore((s) => s.setRelationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setShowWrapped = useUIStore((s) => s.setShowWrapped);
  const setShowMomentCreator = useUIStore((s) => s.setShowMomentCreator);

  const [inviteCode, setInviteCode] = useState<string | null>(relationship?.invite_code ?? null);
  const [editField, setEditField] = useState<'name' | 'space' | 'email' | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<AvatarPreview | null>(null);
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

  const waitingForPartner = !!relationship && !partner;

  useEffect(() => {
    if (!relationship || partner) {
      setInviteCode(null);
      return;
    }

    if (relationship.invite_code) {
      setInviteCode(relationship.invite_code);
      return;
    }

    let cancelled = false;
    api
      .ensureInviteCode(relationship.id)
      .then((rel) => {
        if (cancelled) return;
        setRelationship(rel);
        setInviteCode(rel.invite_code);
      })
      .catch(() => {
        if (!cancelled) setInviteCode(null);
      });

    return () => {
      cancelled = true;
    };
  }, [relationship, partner, setRelationship]);

  const copyInviteCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied!', 'Invite code copied to clipboard');
  };

  const shareInviteCode = async () => {
    if (!inviteCode) return;
    await Share.share({
      message: `Join me on Moments! Use invite code: ${inviteCode}\n\nMoments is our private relationship space.`,
    });
  };

  const relationshipDuration = relationship
    ? formatDistanceToNow(getRelationshipAnniversaryDate(relationship), { addSuffix: false })
    : '';
  const { isPlus, isOwner } = useSubscription();
  const plusExpiryLabel = formatSubscriptionExpiry(user?.subscription_expires_at);

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
        ? "You'll close this empty space. Your account stays — then join your partner's invite code from the next screen (or Profile → Join partner's space)."
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
      } else if (editField === 'email' && user) {
        const { error } = await supabase.auth.updateUser({ email: trimmed });
        if (error) throw error;
        const updated = await api.updateProfile(user.id, { email: trimmed });
        setUser(updated);
        Alert.alert('Check your inbox', 'We sent a confirmation link to your new email address.');
      }
      closeEdit();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSavingEdit(false);
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
    if (!user?.email) {
      Alert.alert('Cannot change password', 'No email is linked to this account.');
      return;
    }

    setSavingPassword(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        Alert.alert('Wrong password', 'Your current password is incorrect.');
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      closePasswordModal();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Password updated', 'Your new password is ready to use next time you sign in.');
    } catch (e) {
      Alert.alert('Could not update password', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSavingPassword(false);
    }
  };

  const editModalTitle =
    editField === 'name' ? 'Display name' : editField === 'space' ? 'Space name' : 'Email address';
  const editModalLabel =
    editField === 'name'
      ? 'This is how your partner sees you'
      : editField === 'space'
        ? 'Your shared space name'
        : 'We will send a confirmation link to the new address';

  return (
    <ScreenContainer padded={false}>
      <AppHeader />
      <TabScreenScroll showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Overview */}
        <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.overview}>
          <View style={styles.avatarsRow}>
            <Pressable
              onPress={() =>
                setAvatarPreview({
                  imageUrl: user?.avatar_url,
                  title: user?.name?.trim() || 'You',
                  fallbackName: user?.name,
                })
              }
              accessibilityRole="button"
              accessibilityLabel="View your profile photo">
              <Avatar name={user?.name} imageUrl={user?.avatar_url} size={96} colorsOverride={['#fff', '#fff']} />
            </Pressable>

            <View style={styles.avatarLink} accessibilityElementsHidden>
              <ProfileCoupleLink accent={colors.accent} />
            </View>

            <Pressable
              onPress={() =>
                partner &&
                setAvatarPreview({
                  imageUrl: partner.avatar_url,
                  title: partner.name?.trim() || 'Partner',
                  fallbackName: partner.name,
                })
              }
              disabled={!partner}
              accessibilityRole="button"
              accessibilityLabel={partner ? `View ${partner.name ?? 'partner'} photo` : 'Partner photo'}>
              <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={96} colorsOverride={['#fff', '#fff']} />
            </Pressable>
          </View>
          <Text style={styles.relName}>
            {getFirstName(user?.name) ?? 'You'}
            {partner ? ` & ${getFirstName(partner.name) ?? 'Partner'}` : ''}
          </Text>
          {partner ? (
            <Text style={styles.together}>Together {relationshipDuration}</Text>
          ) : (
            <Text style={styles.together}>Waiting for your partner to join</Text>
          )}
        </LinearGradient>

        <ProfileAnniversarySection />

        <Pressable
          onPress={() => setShowWrapped(true)}
          style={({ pressed }) => [
            styles.wrappedCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Wrapped ${new Date().getFullYear()}`}>
          <Icon name="star" size={24} color={colors.accent} filled />
          <View style={styles.wrappedCopy}>
            <Text style={[styles.wrappedTitle, { color: colors.text }]}>
              Wrapped {new Date().getFullYear()}
            </Text>
            <Text style={[styles.wrappedSub, { color: colors.textSecondary }]}>
              See your year together in moments, streaks, and highlights
            </Text>
          </View>
          <Icon name="chevronRight" size={20} color={colors.textSecondary} />
        </Pressable>

        {/* Subscription banner */}
        <Pressable onPress={() => router.push('/pro')}>
          <LinearGradient
            colors={isPlus ? [colors.success, colors.accent] : colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.subBanner}>
            <Icon name="star" size={22} color="#fff" filled />
            <View style={{ flex: 1 }}>
              <Text style={styles.subTitle}>{isPlus ? 'Moments Plus active' : 'Upgrade to Moments Plus'}</Text>
              <Text style={styles.subDesc}>
                {isPlus
                  ? isOwner
                    ? plusExpiryLabel
                      ? `Your plan · renews ${plusExpiryLabel}`
                      : 'Your plan · one subscription for both of you'
                    : `Included on ${partner?.name ?? 'your partner'}'s plan`
                  : 'One plan for both of you'}
              </Text>
            </View>
            {!isPlus && <Icon name="chevronRight" size={20} color="#fff" />}
          </LinearGradient>
        </Pressable>

        {waitingForPartner ? (
          <Card style={styles.inviteCard}>
            {inviteCode ? (
              <>
                <Text style={[styles.inviteTitle, { color: colors.text }]}>Invite your partner</Text>
                <Text style={[styles.inviteSub, { color: colors.textSecondary }]}>
                  Share this code so they can join your space
                </Text>
                <Pressable
                  onPress={copyInviteCode}
                  style={[styles.codeBox, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
                  <Text style={[styles.code, { color: colors.text }]}>{inviteCode}</Text>
                  <Text style={[styles.tapCopy, { color: colors.textSecondary }]}>Tap to copy</Text>
                </Pressable>
                <PrimaryButton label="Share Invite" onPress={shareInviteCode} />

                <View style={styles.inviteDividerRow}>
                  <View style={[styles.inviteDividerLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.inviteDividerText, { color: colors.textTertiary }]}>or</Text>
                  <View style={[styles.inviteDividerLine, { backgroundColor: colors.border }]} />
                </View>
              </>
            ) : null}

            <Text style={[styles.joinInsteadTitle, { color: colors.text }]}>Partner already has a space?</Text>
            <Text style={[styles.joinInsteadSub, { color: colors.textSecondary }]}>
              If you both created a space, agree on one invite code. Enter your partner&apos;s code below and your
              empty space will close automatically.
            </Text>
            <Pressable
              onPress={() => router.push('/(onboarding)/join-relationship?from=profile')}
              style={({ pressed }) => [
                styles.joinInsteadBtn,
                {
                  backgroundColor: pressed ? colors.accentSoft : colors.surfaceElevated,
                  borderColor: pressed ? colors.accent : colors.border,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Join partner's space">
              <Text style={[styles.joinInsteadBtnText, { color: colors.accent }]}>Join partner&apos;s space</Text>
              <Icon name="chevronRight" size={18} color={colors.accent} strokeWidth={2.2} />
            </Pressable>
          </Card>
        ) : null}

        <View style={styles.sectionBlock}>
          <SectionTitle style={styles.sectionLabel}>Account</SectionTitle>
          <View style={styles.stack}>
            <Card>
              <Pressable onPress={changeProfilePhoto} style={styles.accountPhotoRow} disabled={avatarSaving}>
                <Avatar name={user?.name} imageUrl={user?.avatar_url} size={76} />
                <View style={styles.accountPhotoCopy}>
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
                colors={colors}
                onPress={() => openEdit('name', user?.name ?? '')}
              />
              <SettingEditItem
                icon="compass"
                label="Gender"
                value={profileGenderLabel(user?.gender)}
                colors={colors}
                onPress={openGenderModal}
              />
              <SettingEditItem
                icon="mail"
                label="Email"
                value={user?.email ?? ''}
                colors={colors}
                onPress={() => openEdit('email', user?.email ?? '')}
              />
              <SettingEditItem
                icon="lock"
                label="Password"
                value="Tap to change"
                colors={colors}
                onPress={openPasswordModal}
                last
              />
            </Card>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <SectionTitle style={styles.sectionLabel}>Appearance</SectionTitle>
          <View style={styles.themeGrid}>
            {THEME_META.map((t) => {
              const active = theme === t.key;
              return (
                <View key={t.key} style={styles.themeCell}>
                  <Pressable
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
                    <Text
                      style={[styles.themeLabel, { color: active ? colors.text : colors.textSecondary }]}
                      numberOfLines={2}>
                      {t.label}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>

        {relationship && relationship.status !== 'ended' ? (
          <View style={styles.sectionBlock}>
            <SectionTitle style={styles.sectionLabel}>Relationship</SectionTitle>
            <View style={styles.stack}>
              <Card padded={false}>
                <SettingEditItem
                  icon="heart"
                  label="Space name"
                  value={relationship.relationship_name?.trim() || 'Our Moments'}
                  colors={colors}
                  onPress={() => openEdit('space', relationship.relationship_name ?? '')}
                />
                <SettingEditItem
                  icon="compass"
                  label="Relationship type"
                  value={relationshipTypeLabel(relationship.relationship_type)}
                  colors={colors}
                  onPress={openRelationshipTypeModal}
                  last
                />
              </Card>
              <Card padded={false}>
                <SettingItem
                  icon="close"
                  label="Leave relationship"
                  colors={colors}
                  tint={colors.error}
                  onPress={handleLeaveRelationship}
                  last
                />
              </Card>
            </View>
          </View>
        ) : null}

        <View style={styles.sectionBlock}>
          <SectionTitle style={styles.sectionLabel}>Privacy & Data</SectionTitle>
          <View style={styles.stack}>
            <Card padded={false}>
              <OnlineStatusSettings />
            </Card>
            <Card padded={false}>
              <LocationSharingSettings />
            </Card>
            <Card padded={false}>
              <SettingItem
                icon="star"
                label="Rate Moments"
                colors={colors}
                onPress={() => {
                  void requestStoreReviewFromSettings();
                }}
                last
              />
            </Card>
            <Card padded={false}>
              <SettingItem
                icon="lock"
                label="Privacy Policy"
                colors={colors}
                onPress={() => router.push('/legal/privacy')}
              />
              <SettingItem
                icon="list"
                label="Terms of Service"
                colors={colors}
                onPress={() => router.push('/legal/terms')}
              />
            </Card>
            <Card padded={false}>
              <SettingItem icon="logout" label="Sign Out" colors={colors} tint={colors.accent} onPress={handleLogout} />
              <SettingItem
                icon="trash"
                label="Delete Account"
                colors={colors}
                tint={colors.error}
                onPress={handleDeleteAccount}
                last
              />
            </Card>
          </View>
        </View>

        <View style={styles.brandFooter}>
          <LogoMark size={32} />
          <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 6 }}>Moments · Closer, every day</Text>
        </View>
      </TabScreenScroll>

      <FullScreenImageModal
        visible={avatarPreview !== null}
        imageUrl={avatarPreview?.imageUrl}
        title={avatarPreview?.title}
        fallbackName={avatarPreview?.fallbackName}
        onClose={() => setAvatarPreview(null)}
      />

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
    </ScreenContainer>
  );
}

function SettingEditItem({
  icon,
  label,
  value,
  colors,
  onPress,
  last,
}: {
  icon: IconName;
  label: string;
  value: string;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        pressed && { opacity: 0.6 },
      ]}>
      <View style={styles.settingLeft}>
        <Icon name={icon} size={20} color={colors.textSecondary} />
        <View style={{ flex: 1 }}>
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
  colors,
  onPress,
  tint,
  last,
}: {
  icon: IconName;
  label: string;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress: () => void;
  tint?: string;
  last?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
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
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xl,
    gap: Spacing.sm,
  },
  sectionBlock: {
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  stack: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    marginBottom: 0,
  },
  overview: { borderRadius: Radius.xl, padding: 22, alignItems: 'center' },
  avatarsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  avatarLink: {
    marginHorizontal: -10,
    zIndex: 2,
  },
  relName: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 16, textAlign: 'center' },
  together: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  subBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
  },
  subTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  subDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 1 },
  wrappedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  wrappedCopy: { flex: 1 },
  wrappedTitle: { fontSize: 16, fontWeight: '800' },
  wrappedSub: { fontSize: 13, marginTop: 2 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  themeCell: { width: '20%', alignItems: 'center', marginBottom: Spacing.md, paddingHorizontal: 2 },
  themeItem: { alignItems: 'center', gap: 8, width: '100%' },
  themeLabel: { fontSize: 12, fontWeight: '600', textAlign: 'center', lineHeight: 15, minHeight: 30, width: '100%' },
  swatch: { width: 60, height: 60, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: Spacing.lg },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: '600' },
  settingSub: { fontSize: 12, marginTop: 2 },
  accountPhotoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  accountPhotoCopy: { flex: 1 },
  brandFooter: { alignItems: 'center', marginTop: Spacing.lg, paddingTop: Spacing.xs },
  inviteCard: { gap: 0 },
  inviteTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  inviteSub: { fontSize: 14, lineHeight: 20, marginBottom: 14 },
  inviteDividerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 20, marginBottom: 16 },
  inviteDividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  inviteDividerText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  joinInsteadTitle: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  joinInsteadSub: { fontSize: 13, lineHeight: 19, marginBottom: 12 },
  joinInsteadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
  },
  joinInsteadBtnText: { fontSize: 15, fontWeight: '600' },
  codeBox: {
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    paddingVertical: 18,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    marginBottom: 14,
  },
  code: { fontSize: 32, fontWeight: '800', letterSpacing: 6 },
  tapCopy: { fontSize: 12, marginTop: 6 },
});
