import { formatDistanceToNow } from 'date-fns';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, type Href } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { ChangePasswordModal } from '@/components/profile/ChangePasswordModal';
import { EditFieldModal } from '@/components/profile/EditFieldModal';
import { LocationSharingSettings } from '@/components/profile/LocationSharingSettings';
import { SharedAlbum } from '@/components/profile/SharedAlbum';
import { Icon, type IconName } from '@/components/ui/Icon';
import { LogoMark } from '@/components/ui/Logo';
import { Avatar, Card, PrimaryButton, SectionTitle, StatPill } from '@/components/ui/primitives';
import { THEME_META } from '@/constants/design-system';
import { useBucketList, useJournalEntries, useMoments, useStreak } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { enrichMomentsWithAuthors, filterMediaMoments } from '@/lib/moment-display';
import { formatSubscriptionExpiry } from '@/lib/subscription';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/providers/AppProviders';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';

const PROFILE_TABS = [
  { key: 'album', label: 'Album' },
  { key: 'journal', label: 'Journal' },
  { key: 'settings', label: 'Settings' },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, theme, setTheme } = useTheme();
  const relationship = useRelationshipStore((s) => s.relationship);
  const setRelationship = useRelationshipStore((s) => s.setRelationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const resetAuth = useAuthStore((s) => s.reset);
  const resetRelationship = useRelationshipStore((s) => s.reset);
  const setShowMomentHistory = useUIStore((s) => s.setShowMomentHistory);
  const setShowMomentCreator = useUIStore((s) => s.setShowMomentCreator);

  const { data: momentsData } = useMoments();
  const { data: streak } = useStreak();
  const { data: journalEntries } = useJournalEntries();
  const { data: bucketList } = useBucketList();
  const [tab, setTab] = useState<'album' | 'journal' | 'settings'>('album');
  const [inviteCode, setInviteCode] = useState<string | null>(relationship?.invite_code ?? null);
  const [editField, setEditField] = useState<'name' | 'space' | 'email' | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
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

  const timelineMoments = momentsData?.pages.flat() ?? [];
  const albumMoments = useMemo(
    () => enrichMomentsWithAuthors(filterMediaMoments(timelineMoments), user, partner),
    [timelineMoments, user, partner],
  );
  const relationshipDuration = relationship
    ? formatDistanceToNow(new Date(relationship.created_at), { addSuffix: false })
    : '';
  const { isPlus, isOwner, limits } = useSubscription();
  const { requirePlus } = usePlusGate();
  const plusExpiryLabel = formatSubscriptionExpiry(user?.subscription_expires_at);
  const albumLimit = limits.timelineMoments;
  const hiddenAlbumCount = Number.isFinite(albumLimit)
    ? Math.max(0, albumMoments.length - albumLimit)
    : 0;

  const openSharedAlbum = () => setShowMomentHistory(true);
  const unlockSharedAlbum = () => {
    requirePlus('Full shared album');
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    resetAuth();
    resetRelationship();
    router.replace('/(auth)/login');
  };

  const handleDeleteAccount = () => {
    Alert.alert('Delete Account', 'This permanently removes your account and data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          resetAuth();
          resetRelationship();
          router.replace('/(auth)/login');
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
            resetRelationship();
            queryClient.clear();
            router.replace('/(onboarding)/create-relationship');
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
            <Avatar name={user?.name} imageUrl={user?.avatar_url} size={56} colorsOverride={['#fff', '#fff']} />
            <View style={styles.heartBetween}>
              <Icon name="heart" size={20} color="#fff" filled />
            </View>
            <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={56} colorsOverride={['#fff', '#fff']} />
          </View>
          <Text style={styles.relName}>{relationship?.relationship_name ?? 'Moments'}</Text>
          {partner ? (
            <Text style={styles.partner}>with {partner.name} · together {relationshipDuration}</Text>
          ) : (
            <Text style={styles.partner}>Waiting for your partner to join</Text>
          )}
        </LinearGradient>

        <View style={styles.statsRow}>
          <StatPill value={timelineMoments.length} label="Moments" />
          <StatPill value={streak?.current_streak ?? 0} label="Streak" />
          <StatPill value={bucketList?.filter((b) => b.status === 'completed').length ?? 0} label="Done" />
        </View>

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

        {waitingForPartner && (
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
        )}

        {/* Tabs */}
        <View style={[styles.segment, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          {PROFILE_TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.segmentItem, tab === t.key && { backgroundColor: colors.surface }]}>
              <Text style={{ color: tab === t.key ? colors.text : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {tab === 'album' && (
          <View style={styles.tabBody}>
            <SharedAlbum
              moments={albumMoments}
              previewLimit={albumLimit}
              hiddenCount={hiddenAlbumCount}
              onOpenFull={openSharedAlbum}
              onUnlockFull={unlockSharedAlbum}
              onAddMoment={() => setShowMomentCreator(true)}
            />
          </View>
        )}

        {tab === 'journal' && (
          <View style={styles.tabBody}>
            <SectionTitle action="New entry" onAction={() => router.push('/journal/compose' as Href)}>
              Journal
            </SectionTitle>
            {!journalEntries || journalEntries.length === 0 ? (
              <EmptyState icon="journal" text="Write your first journal entry" />
            ) : (
              journalEntries.slice(0, 10).map((e) => (
                <Card key={e.id} style={{ marginBottom: 10 }}>
                  <Text style={[styles.journalType, { color: colors.accent }]}>{e.type}</Text>
                  <Text style={{ color: colors.text, lineHeight: 21 }}>{e.content}</Text>
                  <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 8 }}>
                    {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                  </Text>
                </Card>
              ))
            )}
          </View>
        )}

        {tab === 'settings' && (
          <View style={styles.tabBody}>
            <SectionTitle>Account</SectionTitle>
            <Card style={styles.accountCard}>
              <Pressable onPress={changeProfilePhoto} style={styles.accountPhotoRow} disabled={avatarSaving}>
                <Avatar name={user?.name} imageUrl={user?.avatar_url} size={56} />
                <View style={styles.accountPhotoCopy}>
                  <Text style={[styles.settingTitle, { color: colors.text }]}>
                    {avatarSaving ? 'Updating photo…' : 'Profile photo'}
                  </Text>
                  <Text style={[styles.settingSub, { color: colors.textSecondary }]}>Tap to change</Text>
                </View>
                <Icon name="camera" size={20} color={colors.textSecondary} />
              </Pressable>
            </Card>
            <Card padded={false} style={{ marginBottom: 20 }}>
              <SettingEditItem
                icon="user"
                label="Display name"
                value={user?.name?.trim() || 'Add your name'}
                colors={colors}
                onPress={() => openEdit('name', user?.name ?? '')}
              />
              <SettingEditItem
                icon="journal"
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

            <SectionTitle>Appearance</SectionTitle>
            <View style={styles.themeRow}>
              {THEME_META.map((t) => {
                const active = theme === t.key;
                return (
                  <Pressable key={t.key} onPress={() => setTheme(t.key)} style={styles.themeItem}>
                    <View style={[styles.swatch, { backgroundColor: t.swatch, borderColor: active ? colors.accent : colors.border, borderWidth: active ? 2.5 : 1 }]}>
                      {active && <Icon name="check" size={18} color={colors.accent} />}
                    </View>
                    <Text style={{ color: active ? colors.text : colors.textSecondary, fontSize: 11, fontWeight: '600' }}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <SectionTitle>Relationship</SectionTitle>

            {relationship && relationship.status !== 'ended' && (
              <Card padded={false} style={{ marginBottom: 12 }}>
                <SettingEditItem
                  icon="heart"
                  label="Space name"
                  value={relationship.relationship_name?.trim() || 'Our Moments'}
                  colors={colors}
                  onPress={() => openEdit('space', relationship.relationship_name ?? '')}
                  last
                />
              </Card>
            )}

            {relationship && relationship.status !== 'ended' && (
              <Card padded={false} style={styles.leaveCard}>
                <SettingItem
                  icon="close"
                  label="Leave relationship"
                  colors={colors}
                  tint={colors.error}
                  onPress={handleLeaveRelationship}
                  last
                />
              </Card>
            )}

            <View style={styles.privacySection}>
              <SectionTitle>Privacy & Data</SectionTitle>
            </View>
            <Card padded={false} style={{ marginBottom: 12 }}>
              <LocationSharingSettings />
            </Card>
            <Card padded={false}>
              <SettingItem icon="lock" label="Privacy Policy" colors={colors} onPress={() => router.push('/legal/privacy')} />
              <SettingItem icon="list" label="Terms of Service" colors={colors} onPress={() => router.push('/legal/terms')} />
              <SettingItem icon="image" label="Export my data" colors={colors} onPress={() => Alert.alert('Data Export', 'Your data export will be emailed within 24 hours.')} />
            </Card>

            <Card padded={false} style={{ marginTop: 12 }}>
              <SettingItem icon="logout" label="Sign Out" colors={colors} tint={colors.accent} onPress={handleLogout} />
              <SettingItem icon="trash" label="Delete Account" colors={colors} tint={colors.error} onPress={handleDeleteAccount} last />
            </Card>

            <View style={styles.brandFooter}>
              <LogoMark size={32} />
              <Text style={{ color: colors.textTertiary, fontSize: 12, marginTop: 6 }}>Moments · Closer, every day</Text>
            </View>
          </View>
        )}
      </TabScreenScroll>

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

function EmptyState({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
        <Icon name={icon} size={26} color={colors.textTertiary} />
      </View>
      <Text style={{ color: colors.textSecondary }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16 },
  overview: { borderRadius: 24, padding: 22, alignItems: 'center' },
  avatarsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heartBetween: { paddingHorizontal: 10 },
  relName: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 14 },
  partner: { fontSize: 14, color: 'rgba(255,255,255,0.9)', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  subBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, marginTop: 16 },
  subTitle: { color: '#fff', fontWeight: '800', fontSize: 15 },
  subDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 1 },
  segment: { flexDirection: 'row', borderRadius: 14, padding: 4, marginTop: 20, borderWidth: StyleSheet.hairlineWidth },
  segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10 },
  tabBody: { marginTop: 18 },
  journalType: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  themeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 20 },
  themeItem: { alignItems: 'center', gap: 6, width: 56 },
  swatch: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  settingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  settingTitle: { fontSize: 15, fontWeight: '600' },
  settingSub: { fontSize: 12, marginTop: 2 },
  accountCard: { marginBottom: 12 },
  accountPhotoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  accountPhotoCopy: { flex: 1 },
  leaveCard: { marginBottom: 8 },
  privacySection: { marginTop: 16 },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  emptyIcon: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  brandFooter: { alignItems: 'center', marginTop: 28 },
  inviteCard: { marginTop: 16 },
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
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  joinInsteadBtnText: { fontSize: 15, fontWeight: '600' },
  codeBox: { borderRadius: 16, borderWidth: 1.5, paddingVertical: 18, paddingHorizontal: 16, alignItems: 'center', marginBottom: 14 },
  code: { fontSize: 32, fontWeight: '800', letterSpacing: 6 },
  tapCopy: { fontSize: 12, marginTop: 6 },
});
