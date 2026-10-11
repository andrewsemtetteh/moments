import { formatDistanceToNow } from 'date-fns';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { CoupleLevelCard } from '@/components/games/PlayPulse';
import { TabSwipe } from '@/components/layout/TabSwipe';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { ProfileAnniversarySection } from '@/components/profile/ProfileAnniversarySection';
import { ProfileCoupleLink } from '@/components/profile/ProfileCoupleLink';
import { FullScreenImageModal } from '@/components/ui/FullScreenImageModal';
import { Icon } from '@/components/ui/Icon';
import { Avatar, Card, PrimaryButton, SectionTitle, colorWithAlpha } from '@/components/ui/primitives';
import { Radius, Spacing } from '@/constants/design-system';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { getRelationshipAnniversaryDate } from '@/lib/anniversary';
import { getFirstName } from '@/lib/avatar-initial';
import { formatSubscriptionExpiry } from '@/lib/subscription';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';

type AvatarPreview = {
  imageUrl: string | null | undefined;
  title: string;
  fallbackName: string | null | undefined;
};

/**
 * The You tab: your relationship — the two of you, your anniversary, your
 * level, Wrapped, Plus, and the invite code while you wait for your partner.
 * Settings (account, appearance, privacy, sign-out) live behind the gear at
 * the top-right instead of below all of this, and this tab has its own simple
 * header rather than the partner-status header Home and Play share.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const relationship = useRelationshipStore((s) => s.relationship);
  const setRelationship = useRelationshipStore((s) => s.setRelationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);
  const setShowWrapped = useUIStore((s) => s.setShowWrapped);
  const { isPlus, isOwner } = useSubscription();
  const plusExpiryLabel = formatSubscriptionExpiry(user?.subscription_expires_at);

  const [inviteCode, setInviteCode] = useState<string | null>(relationship?.invite_code ?? null);
  const [avatarPreview, setAvatarPreview] = useState<AvatarPreview | null>(null);

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
  const spaceName = relationship?.relationship_name?.trim();

  return (
    // Play ← You → Settings (see TabSwipe).
    <TabSwipe
      onSwipeRight={() => router.navigate('/(tabs)/activities')}
      onSwipeLeft={() => router.navigate('/settings')}>
    <ScreenContainer padded={false}>
      <ScreenHeader
        title={spaceName || 'You'}
        right={
          <HeaderIconButton
            icon="settings"
            onPress={() => router.navigate('/settings')}
            accessibilityLabel="Settings"
          />
        }
      />

      <TabScreenScroll showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
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
              <ProfileCoupleLink accent={colors.accent} ringColor={colors.onAccent} />
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
          <Text style={[styles.relName, { color: colors.onAccent }]}>
            {getFirstName(user?.name) ?? 'You'}
            {partner ? ` & ${getFirstName(partner.name) ?? 'Partner'}` : ''}
          </Text>
          <Text style={[styles.together, { color: colorWithAlpha(colors.onAccent, 0.9) }]}>
            {partner ? `Together ${relationshipDuration}` : 'Waiting for your partner to join'}
          </Text>
        </LinearGradient>

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
                  accessibilityRole="button"
                  accessibilityLabel={`Invite code ${inviteCode}, tap to copy`}
                  style={[
                    styles.codeBox,
                    {
                      backgroundColor: colors.accentSoft,
                      borderColor: colors.accent,
                      borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
                    },
                  ]}>
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
                  borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Join partner's space">
              <Text style={[styles.joinInsteadBtnText, { color: colors.accent }]}>Join partner&apos;s space</Text>
              <Icon name="chevronRight" size={18} color={colors.accent} />
            </Pressable>
          </Card>
        ) : null}

        <ProfileAnniversarySection />

        {partner ? (
          <View style={styles.sectionBlock}>
            <SectionTitle style={styles.sectionLabel}>Play</SectionTitle>
            <CoupleLevelCard />
          </View>
        ) : null}

        <View style={styles.sectionBlock}>
          <Pressable
            onPress={() => setShowWrapped(true)}
            style={({ pressed }) => [
              styles.wrappedCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`Wrapped ${new Date().getFullYear()}`}>
            <View style={[styles.wrappedIcon, { backgroundColor: colors.accentSoft }]}>
              <Icon name="sparkles" size={20} color={colors.accent} filled />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.wrappedTitle, { color: colors.text }]}>
                Wrapped {new Date().getFullYear()}
              </Text>
              <Text style={[styles.wrappedSub, { color: colors.textSecondary }]}>
                Your year together in moments, streaks, and highlights
              </Text>
            </View>
            <Icon name="chevronRight" size={20} color={colors.textTertiary} />
          </Pressable>

          <Pressable
            onPress={() => router.push('/pro')}
            accessibilityRole="button"
            accessibilityLabel={isPlus ? 'Moments Plus active' : 'Upgrade to Moments Plus'}>
            <LinearGradient
              colors={isPlus ? [colors.success, colors.accent] : colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.subBanner}>
              <Icon name="star" size={22} color={colors.onAccent} filled />
              <View style={styles.flex}>
                <Text style={[styles.subTitle, { color: colors.onAccent }]}>
                  {isPlus ? 'Moments Plus active' : 'Upgrade to Moments Plus'}
                </Text>
                <Text style={[styles.subDesc, { color: colorWithAlpha(colors.onAccent, 0.9) }]}>
                  {isPlus
                    ? isOwner
                      ? plusExpiryLabel
                        ? `Your plan · renews ${plusExpiryLabel}`
                        : 'Your plan · one subscription for both of you'
                      : `Included on ${partner?.name ?? 'your partner'}'s plan`
                    : 'One plan for both of you'}
                </Text>
              </View>
              {!isPlus && <Icon name="chevronRight" size={20} color={colors.onAccent} />}
            </LinearGradient>
          </Pressable>
        </View>
      </TabScreenScroll>

      <FullScreenImageModal
        visible={avatarPreview !== null}
        imageUrl={avatarPreview?.imageUrl}
        title={avatarPreview?.title}
        fallbackName={avatarPreview?.fallbackName}
        onClose={() => setAvatarPreview(null)}
      />
    </ScreenContainer>
    </TabSwipe>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  // One gap between every top-level block (hero, invite, anniversary, Play,
  // Wrapped/Plus) and none added on top of it — previously a mix of gap and
  // per-block margins left the spacing uneven (16 / 8 / 24 / 24px).
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.xl,
    gap: 20,
  },
  sectionBlock: { gap: 10 },
  sectionLabel: { marginBottom: 0 },
  overview: { borderRadius: Radius.xl, padding: 22, alignItems: 'center' },
  avatarsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  avatarLink: { marginHorizontal: -10, zIndex: 2 },
  relName: { fontSize: 24, fontWeight: '800', marginTop: 16, textAlign: 'center' },
  together: { fontSize: 14, marginTop: 4 },
  wrappedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
  },
  wrappedIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrappedTitle: { fontSize: 16, fontWeight: '800' },
  wrappedSub: { fontSize: 13, marginTop: 2 },
  subBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
  },
  subTitle: { fontWeight: '800', fontSize: 15 },
  subDesc: { fontSize: 13, marginTop: 1 },
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
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 14,
  },
  joinInsteadBtnText: { fontSize: 15, fontWeight: '600' },
  codeBox: {
    borderRadius: Radius.lg,
    paddingVertical: 18,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    marginBottom: 14,
  },
  code: { fontSize: 32, fontWeight: '800', letterSpacing: 6 },
  tapCopy: { fontSize: 12, marginTop: 6 },
});
