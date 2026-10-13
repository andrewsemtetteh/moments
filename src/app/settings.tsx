import { useUser } from '@clerk/expo';
import { format, parseISO } from 'date-fns';
import Constants from 'expo-constants';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ChangePasswordModal } from '@/components/profile/ChangePasswordModal';
import { EditAnniversaryModal } from '@/components/profile/EditAnniversaryModal';
import { EditFieldModal } from '@/components/profile/EditFieldModal';
// import { EditGenderModal } from '@/components/profile/EditGenderModal';
import { EditRelationshipTypeModal } from '@/components/profile/EditRelationshipTypeModal';
import { LocationSharingSettings } from '@/components/profile/LocationSharingSettings';
import { OnlineStatusSettings } from '@/components/profile/OnlineStatusSettings';
import { VerifyEmailCodeModal } from '@/components/profile/VerifyEmailCodeModal';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar, colorWithAlpha } from '@/components/ui/primitives';
import { THEME_META, Spacing, Themes, type AppTheme, type ThemeColors } from '@/constants/design-system';
import { useSubscription } from '@/hooks/useSubscription';
import { REFERRAL_DAYS } from '@/constants/subscription';
import { useTheme } from '@/hooks/useTheme';
import { getRelationshipAnniversaryIso, isValidAnniversaryIso } from '@/lib/anniversary';
import { formatAuthError } from '@/lib/auth-errors';
import { signOutUser } from '@/lib/auth-session';
import { getFirstName } from '@/lib/avatar-initial';
import { markRelationshipOnboardingDone } from '@/lib/onboarding-storage';
// import { profileGenderLabel } from '@/lib/profile-gender';
import { relationshipTypeLabel } from '@/lib/relationship-type';
import { closeStackScreen } from '@/lib/router';
import { toUserFacingNetworkError } from '@/lib/network-error';
import { requestStoreReviewFromSettings } from '@/lib/store-review';
import { formatSubscriptionExpiry } from '@/lib/subscription';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
// import type { ProfileGender, RelationshipType } from '@/types/database';
import type { RelationshipType } from '@/types/database';
import { ensurePermission } from '@/lib/permissions';

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
  const openPaywall = useUIStore((s) => s.openPaywall);
  const cardSurface = surfaceStyle(colors);
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
  // Gender isn't used anywhere in the app, so it's not asked for (kept for later).
  // const [showGenderModal, setShowGenderModal] = useState(false);
  // const [genderDraft, setGenderDraft] = useState<ProfileGender | null>(user?.gender ?? null);
  // const [savingGender, setSavingGender] = useState(false);
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

  // const openGenderModal = () => {
    // setGenderDraft(user?.gender ?? null);
    // setShowGenderModal(true);
  // };

  // const closeGenderModal = () => {
    // setShowGenderModal(false);
    // setGenderDraft(user?.gender ?? null);
  // };

  // const saveGender = async (gender: ProfileGender) => {
    // if (!user) return;

    // setGenderDraft(gender);
    // setSavingGender(true);
    // try {
      // const updated = await api.updateProfile(user.id, { gender });
      // setUser(updated);
      // closeGenderModal();
      // Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // } catch (e) {
      // Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    // } finally {
      // setSavingGender(false);
    // }
  // };

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
            {/* <Row icon="people" label="Gender" value={profileGenderLabel(user?.gender)} onPress={openGenderModal} /> */}
            <Row icon="mail" label="Email" value={user?.email ?? ''} onPress={() => openEdit('email', user?.email ?? '')} />
            <Row icon="lock" label="Password" value="••••••••" onPress={openPasswordModal} last />
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

        <Section title="Appearance">
          <View style={[styles.card, styles.themeCard, cardSurface]}>
            {THEME_META.map((t) => (
              <ThemePreview key={t.key} themeKey={t.key} label={t.label} active={theme === t.key} onPress={() => setTheme(t.key)} />
            ))}
          </View>
        </Section>

        <Section
          title="Privacy"
          note={`Only ${partner ? getFirstName(partner.name) ?? 'your partner' : 'your partner'} can ever see these. Turning one off hides it for both of you.`}>
          <Group>
            <OnlineStatusSettings />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <LocationSharingSettings />
          </Group>
        </Section>

        <Section title="Moments Plus">
          <Group>
            <Row
              icon="diamond"
              label="Your plan"
              value={isPlus ? (isOwner ? 'Plus' : `Plus · via ${getFirstName(partner?.name) ?? 'partner'}`) : 'Free'}
              onPress={openPaywall}
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
              onPress={() =>
                Alert.alert('Restore purchases', 'Nothing to restore yet. Purchases will be available once billing is connected.')
              }
              last
            />
          </Group>
        </Section>

        <Section title="Support">
          <Group>
            <Row icon="star" label="Rate Moments" onPress={() => void requestStoreReviewFromSettings()} />
            <Row icon="lock" label="Privacy policy" onPress={() => router.push('/legal/privacy')} />
            <Row icon="document" label="Terms of service" onPress={() => router.push('/legal/terms')} last />
          </Group>
        </Section>

        {__DEV__ ? (
          <Section title="Developer" note="Walk the whole onboarding with sample data. Nothing is saved or sent.">
            <Group>
              <Row
                icon="play"
                label="Walk through onboarding"
                onPress={() => router.push({ pathname: '/(onboarding)/about-you', params: { preview: '1' } })}
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
                last
              />
            </Group>
          </Section>
        ) : null}

        <Pressable
          onPress={handleLogout}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, styles.signOut, cardSurface, pressed && styles.pressed]}>
          <Icon name="logout" size={20} color={colors.error} />
          <Text style={[styles.signOutText, { color: colors.error }]}>Sign out</Text>
        </Pressable>

        <Section
          title="Danger zone"
          note="Leaving closes your shared space for both of you. Deleting removes your account and data for good.">
          <Group>
            {relationship && relationship.status !== 'ended' ? (
              <Row icon="close" label="Leave relationship" danger onPress={handleLeaveRelationship} />
            ) : null}
            <Row icon="trash" label="Delete account" danger onPress={handleDeleteAccount} last />
          </Group>
        </Section>

        <Text style={[styles.footer, { color: colors.textTertiary }]}>
          Moments {Constants.expoConfig?.version ?? ''} · Closer, every day
        </Text>
      </ScrollView>

      <EditFieldModal
        visible={editField !== null}
        title={editModalTitle}
        label={editModalLabel}
        value={editDraft}
        placeholder={editField === 'email' ? 'you@example.com' : editField === 'space' ? 'Our little world' : 'Your name'}
        keyboardType={editField === 'email' ? 'email-address' : 'default'}
        autoCapitalize={editField === 'email' ? 'none' : 'words'}
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

      {/* <EditGenderModal
        visible={showGenderModal}
        value={user?.gender}
        savingValue={savingGender ? genderDraft : null}
        onSelect={(g) => void saveGender(g)}
        onClose={closeGenderModal}
      /> */}

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

function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {children}
      {note ? <Text style={[styles.note, { color: colors.textTertiary }]}>{note}</Text> : null}
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
  return colors.boldBorder ? colors.backgroundElevated : colors.surfaceElevated;
}

function surfaceStyle(colors: ThemeColors) {
  return {
    backgroundColor: colors.surface,
    borderWidth: colors.boldBorder ? 2 : 0,
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
  last,
}: {
  icon: IconName;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  const tint = danger ? colors.error : colors.text;
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
          !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        ]}>
        <Text style={[styles.rowLabel, { color: tint }]} numberOfLines={1}>
          {label}
        </Text>
        {value ? (
          <Text style={[styles.rowValue, { color: colors.textSecondary }]} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        <Icon name="chevronRight" size={16} color={colors.textTertiary} />
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
        <LinearGradient colors={t.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.mockHero} />
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
  note: { fontSize: 13, lineHeight: 18, paddingHorizontal: 6 },
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
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 60 },

  themeCard: { flexDirection: 'row', gap: 10, padding: 14 },
  themeItem: { flex: 1, alignItems: 'center', gap: 8 },
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
