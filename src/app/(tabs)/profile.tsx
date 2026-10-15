import { useQuery } from '@tanstack/react-query';
import { differenceInCalendarDays, format } from 'date-fns';
import * as Haptics from '@/lib/haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StreakFlame } from '@/components/home/StreakFlame';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { TabSwipe } from '@/components/layout/TabSwipe';
import { ProfileAnniversarySection } from '@/components/profile/ProfileAnniversarySection';
import { ProfileCoupleLink } from '@/components/profile/ProfileCoupleLink';
import { DaysTogetherCard } from '@/components/share/DaysTogetherCard';
import { ShareCardModal } from '@/components/share/ShareCardModal';
import { FullScreenImageModal } from '@/components/ui/FullScreenImageModal';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar, colorWithAlpha } from '@/components/ui/primitives';
import { Spacing, type ThemeColors } from '@/constants/design-system';
import { useStreak } from '@/hooks/queries';
import { useOpenPartnerProfile } from '@/hooks/useOpenPartnerProfile';
import { REFERRAL_DAYS } from '@/constants/subscription';
import { usePlanActions } from '@/hooks/usePlanActions';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { getRelationshipAnniversaryDate } from '@/lib/anniversary';
import { getFirstName } from '@/lib/avatar-initial';
import { emptyProgress, levelInfo, todayKey } from '@/lib/play-progress';
import { openActivities } from '@/lib/router';
import { formatSubscriptionExpiry } from '@/lib/subscription';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import { usePlayProgressStore } from '@/stores/play-progress-store';
import type { Relationship, UserProfile } from '@/types/database';
import { ensurePermission } from '@/lib/permissions';
import { InviteCard } from '@/components/home/HomeCards';

/**
 * DEV "Preview UI" mode has no partner or space, so the page would only ever
 * show its waiting state. There it renders as a paired couple with these
 * samples instead, so the real page can be checked on a phone.
 */
const PREVIEW_PARTNER = { id: 'preview-partner', name: 'Alex', avatar_url: null } as unknown as UserProfile;
const PREVIEW_RELATIONSHIP = {
  id: 'preview',
  relationship_name: 'Our little world',
  status: 'active',
  created_at: '2025-03-04T12:00:00.000Z',
  anniversary_date: '2025-03-04',
  invite_code: null,
} as unknown as Relationship;

const PLUS_GRADIENT: [string, string, string] = ['#FF6B7A', '#F03A55', '#C41E45'];
/** Whether a #rrggbb colour is dark enough to need light status-bar icons. */
function isDarkColor(hex: string) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

/** Text and icons on the light chips over the band. */
const INK = '#1A1A1A';
const AVATAR = 96;
/** Photo-less avatars are white with an ink initial, so they read on any band colour. */
const WHITE: [string, string] = ['#FFFFFF', '#FFFFFF'];
const PLUS_INK = '#FFFFFF';
const PLUS_INK_SOFT = 'rgba(255,255,255,0.84)';
/** The Try button: white with the deep red as its label. */
const PLUS_RED = '#C41E45';

type AvatarPreview = {
  imageUrl: string | null | undefined;
  title: string;
  fallbackName: string | null | undefined;
};

/** A card's fill, plus the theme's border where cards need one (Paper). */
function cardSurface(colors: ThemeColors) {
  return { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: colors.boldBorder ? 2 : colors.sticker ? 1 : 0 };
}

/**
 * The You tab, top to bottom: the two of you (photos, how long, quick
 * actions), your numbers, the anniversary, Wrapped, your Play level and Plus.
 * Before your partner joins: you, then the invite. Settings sit behind the
 * gear (or a swipe left).
 */
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const storedRelationship = useRelationshipStore((s) => s.relationship);
  const storedPartner = useRelationshipStore((s) => s.partner);
  const previewMode = __DEV__ && !storedRelationship;
  const relationship = previewMode ? PREVIEW_RELATIONSHIP : storedRelationship;
  const partner = previewMode ? PREVIEW_PARTNER : storedPartner;
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const setShowWrapped = useUIStore((s) => s.setShowWrapped);
  // The Plus card: paywall (Free), Customer Center (paid here), or a note (partner pays).
  const { openPlan } = usePlanActions();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for the quick actions commented out below
  const openPartnerProfile = useOpenPartnerProfile();
  const { isPlus, isOwner } = useSubscription();
  const plusExpiryLabel = formatSubscriptionExpiry(user?.subscription_expires_at);
  const { data: streak } = useStreak();
  const { data: momentCount } = useQuery({
    queryKey: ['momentCount', relationship?.id],
    queryFn: () => api.countMoments(relationship!.id),
    enabled: !!relationship?.id && !previewMode,
  });
  const playProgress = usePlayProgressStore((s) => s.progress);
  const level = useMemo(() => levelInfo((playProgress ?? emptyProgress(todayKey())).xp), [playProgress]);

  const [avatarPreview, setAvatarPreview] = useState<AvatarPreview | null>(null);
   
  const [photoSaving, setPhotoSaving] = useState(false);
  const [shareDays, setShareDays] = useState(false);

  const waitingForPartner = !!relationship && !partner;

   
  const changePhoto = async () => {
    if (!user || previewMode) return;
    if (!(await ensurePermission('photos'))) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    setPhotoSaving(true);
    try {
      const avatarUrl = await api.uploadProfileAvatar(user.id, result.assets[0].uri);
      setUser(await api.updateProfile(user.id, { avatar_url: avatarUrl }));
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Could not update photo', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setPhotoSaving(false);
    }
  };

  const since = relationship ? getRelationshipAnniversaryDate(relationship) : null;
  const daysTogether = since ? Math.max(0, differenceInCalendarDays(new Date(), since)) : 0;
  const bestStreak = Math.max(streak?.longest_streak ?? 0, streak?.current_streak ?? 0);
  const partnerFirst = getFirstName(partner?.name) ?? 'Partner';
  // The top band: the theme's hero colour, flat, with its own text colour on it.
  const band = colors.hero ? colors.hero[0] : colors.gradient[0];
  const onBand = colors.onHero ?? colors.onGradient;
  // The band runs under the status bar: its icons follow the band (white on a dark one, e.g. Paper's black),
  // then go back to the theme's when you leave.
  const bandIsDark = isDarkColor(band);
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle(bandIsDark ? 'light' : 'dark', true);
      return () => setStatusBarStyle(colors.isDark ? 'light' : 'dark', true);
    }, [bandIsDark, colors.isDark]),
  );
  const year = new Date().getFullYear();

  const plusLine = isPlus
    ? isOwner
      ? plusExpiryLabel
        ? `Your plan · renews ${plusExpiryLabel}`
        : 'Your plan · one subscription for both of you'
      : `Included on ${partnerFirst}’s plan`
    : 'One plan for both of you · try it free';

  return (
    // Play ← You → Settings (see TabSwipe).
    <TabSwipe
      onSwipeRight={() => router.navigate('/(tabs)/activities')}
      onSwipeLeft={() => router.navigate('/settings')}>
      <ScreenContainer padded={false}>
        <TabScreenScroll showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* The two of you, on a curved band of the theme's colour. Tapping it shares your days together;
              each photo only opens that photo, and the camera changes yours. */}
          <Pressable
            onPress={() => setShareDays(true)}
            disabled={!partner || !since}
            accessibilityRole="button"
            accessibilityLabel="Share your days together"
            style={[styles.band, { backgroundColor: band, paddingTop: insets.top + 6 }]}>
            {/* Fills the space above when you pull down, so the band never shows a gap. */}
            <View pointerEvents="none" style={[styles.bandBleed, { backgroundColor: band }]} />
            <View style={styles.bandTop}>
              <Text style={[styles.bandTitle, { color: onBand }]} accessibilityRole="header">
                You
              </Text>
              <Pressable
                onPress={() => router.navigate('/settings')}
                accessibilityRole="button"
                accessibilityLabel="Settings"
                style={({ pressed }) => [styles.bandButton, { backgroundColor: colorWithAlpha('#FFFFFF', 0.72) }, pressed && styles.pressed]}>
                <Icon name="settings" size={24} color={INK} />
              </Pressable>
            </View>

            <View style={styles.avatarsRow}>
              <View>
                <Pressable
                  onPress={() =>
                    setAvatarPreview({ imageUrl: user?.avatar_url, title: user?.name?.trim() || 'You', fallbackName: user?.name })
                  }
                  accessibilityRole="button"
                  accessibilityLabel="View your profile photo"
                  style={[styles.avatarRing, { borderColor: colors.background }]}>
                  <Avatar name={user?.name} imageUrl={user?.avatar_url} size={AVATAR} initialColor={INK} colorsOverride={WHITE} />
                </Pressable>
                <Pressable
                  onPress={() => void changePhoto()}
                  disabled={photoSaving}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Change your photo"
                  style={({ pressed }) => [styles.cameraBadge, { borderColor: colors.background }, pressed && styles.pressed]}>
                  {photoSaving ? <ActivityIndicator size="small" color={INK} /> : <Icon name="camera" size={14} color={INK} />}
                </Pressable>
              </View>

              <View style={styles.avatarLink} accessibilityElementsHidden>
                <ProfileCoupleLink accent={colors.accent} ringColor={colors.text} />
              </View>

              {partner ? (
                <Pressable
                  onPress={() =>
                    setAvatarPreview({
                      imageUrl: partner.avatar_url,
                      title: partner.name?.trim() || 'Partner',
                      fallbackName: partner.name,
                    })
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`View ${partner.name ?? 'partner'} photo`}
                  style={[styles.avatarRing, { borderColor: colors.background }]}>
                  <Avatar name={partner.name} imageUrl={partner.avatar_url} size={AVATAR} initialColor={INK} colorsOverride={WHITE} />
                </Pressable>
              ) : (
                <View style={[styles.emptyAvatar, { borderColor: onBand }]}>
                  <Icon name="plus" size={28} color={onBand} />
                </View>
              )}
            </View>

            <Text style={[styles.names, { color: onBand }]} numberOfLines={1} adjustsFontSizeToFit>
              {getFirstName(user?.name) ?? 'You'}
              {partner ? ` & ${partnerFirst}` : ''}
            </Text>
            <Text style={[styles.since, { color: colorWithAlpha(onBand, 0.86) }]}>
              {partner && since ? `Together since ${format(since, 'MMMM d, yyyy')}` : 'Waiting for your person to join'}
            </Text>
          </Pressable>

          {waitingForPartner ? (
            <Section title="Invite your person">
              <InviteCard from="profile" />
            </Section>
          ) : null}

          {partner ? (
            <View style={styles.stats}>
              <Stat
                value={daysTogether.toLocaleString()}
                label="Days together"
                colors={colors}
                onPress={() => setShareDays(true)}
              />
              <Stat value={momentCount != null ? momentCount.toLocaleString() : '…'} label="Moments" colors={colors} />
              <Stat value={String(bestStreak)} label="Best streak" colors={colors} flame />
            </View>
          ) : null}

          <ProfileAnniversarySection relationship={previewMode ? PREVIEW_RELATIONSHIP : undefined} />

          {partner ? (
            <Section title="Your year">
              <Pressable
                onPress={() => setShowWrapped(true)}
                accessibilityRole="button"
                accessibilityLabel={`Your ${year} Wrapped`}
                style={({ pressed }) => [pressed && styles.pressedScale]}>
                <LinearGradient
                  colors={['#2B1B3D', '#6A2C5B', '#C9687A']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[styles.card, styles.cardPad, styles.row]}>
                  <View style={[styles.tile, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
                    <Icon name="gift" size={24} color="#FFFFFF" />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.cardTitle, { color: '#FFFFFF' }]}>Your {year} Wrapped</Text>
                    <Text style={[styles.small, { color: 'rgba(255,255,255,0.8)' }]}>
                      Your year together, in moments and streaks
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={18} color="#FFFFFF" />
                </LinearGradient>
              </Pressable>
            </Section>
          ) : null}

          {partner ? (
            <Section title="Play">
              <Pressable
                onPress={() => openActivities()}
                accessibilityRole="button"
                accessibilityLabel={`Couple level ${level.level}, ${level.title}. Open Play`}
                style={({ pressed }) => [styles.card, styles.rowPad, styles.row, cardSurface(colors), pressed && styles.pressed]}>
                <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.levelBubble}>
                  <Text style={[styles.levelNum, { color: colors.onAccent }]}>{level.level}</Text>
                </LinearGradient>
                <View style={[styles.flex, styles.levelText]}>
                  <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                    Couple level {level.level} · {level.title}
                  </Text>
                  <View style={[styles.trackThin, { backgroundColor: colors.boldBorder ? colors.backgroundElevated : colors.surfaceElevated }]}>
                    <View style={[styles.fill, { width: `${Math.round(level.progress * 100)}%`, backgroundColor: colors.accent }]} />
                  </View>
                  <Text style={[styles.small, { color: colors.textSecondary }]}>
                    {(level.span - level.into).toLocaleString()} XP to {level.nextTitle}
                  </Text>
                </View>
                <Icon name="chevronRight" size={18} color={colors.textTertiary} />
              </Pressable>
            </Section>
          ) : null}

          <Pressable
            onPress={openPlan}
            accessibilityRole="button"
            accessibilityLabel={isPlus ? 'Moments Plus active' : 'Try Moments Plus'}
            style={({ pressed }) => [pressed && styles.pressedScale]}>
            {/* Plus gets its own rich red, the same on every theme, so it reads
                as the premium card rather than another plain row. */}
            <LinearGradient
              colors={PLUS_GRADIENT}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.card,
                styles.rowPad,
                styles.row,
                colors.boldBorder && { borderWidth: 2, borderColor: colors.border },
              ]}>
              <View style={[styles.tile, styles.plusTile]}>
                <Icon name="diamond" size={22} color={PLUS_INK} filled />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { color: PLUS_INK }]}>Moments Plus</Text>
                <Text style={[styles.small, { color: PLUS_INK_SOFT }]} numberOfLines={2}>
                  {plusLine}
                </Text>
              </View>
              {isPlus ? (
                <Icon name="chevronRight" size={18} color={PLUS_INK} />
              ) : (
                <View style={[styles.tryBtn, { backgroundColor: PLUS_INK }]}>
                  <Text style={[styles.tryText, { color: PLUS_RED }]}>Try</Text>
                </View>
              )}
            </LinearGradient>
          </Pressable>

          {/* Not on Plus? Earn it: invite another couple, both get 14 days. */}
          {!isPlus ? (
            <Pressable
              onPress={() => router.push('/refer')}
              accessibilityRole="button"
              accessibilityLabel={`Invite a couple and get ${REFERRAL_DAYS} days of Plus free`}
              style={({ pressed }) => [styles.card, styles.rowPad, styles.row, cardSurface(colors), pressed && styles.pressed]}>
              <View style={[styles.tile, { backgroundColor: '#FFE7A0' }]}>
                <Icon name="gift" size={22} color="#1A1A1A" />
              </View>
              <View style={styles.flex}>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Invite a couple, get {REFERRAL_DAYS} days free</Text>
                <Text style={[styles.small, { color: colors.textSecondary }]} numberOfLines={2}>
                  When they join, you both get {REFERRAL_DAYS} days of Plus.
                </Text>
              </View>
              <Icon name="chevronRight" size={18} color={colors.textTertiary} />
            </Pressable>
          ) : null}
        </TabScreenScroll>

        {partner && since ? (
          <ShareCardModal visible={shareDays} onClose={() => setShareDays(false)} title="Share your days together">
            <DaysTogetherCard
              days={daysTogether}
              names={`${getFirstName(user?.name) ?? 'Me'} & ${partnerFirst}`}
              since={since}
            />
          </ShareCardModal>
        ) : null}

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by the commented-out quick actions
function PillButton({ icon, label, onPress, busy }: { icon: IconName; label: string; onPress: () => void; busy?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.pillBtn,
        {
          backgroundColor: colors.boldBorder ? colors.backgroundElevated : colors.surfaceElevated,
          borderColor: colors.border,
          borderWidth: colors.boldBorder ? 2 : 0,
        },
        pressed && styles.pressed,
      ]}>
      {busy ? <ActivityIndicator size="small" color={colors.text} /> : <Icon name={icon} size={18} color={colors.text} />}
      <Text style={[styles.pillBtnText, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function Stat({
  value,
  label,
  colors,
  flame,
  onPress,
}: {
  value: string;
  label: string;
  colors: ThemeColors;
  flame?: boolean;
  /** Tappable stats (days together) open their share card. */
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.stat, cardSurface(colors), pressed && styles.pressed]}>
      <View style={styles.statValueRow}>
        <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
        {flame ? <StreakFlame size={20} tone={value !== '0' ? 'active' : 'idle'} /> : null}
      </View>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.8 },
  pressedScale: { opacity: 0.92, transform: [{ scale: 0.99 }] },
  // Same rhythm as Home: 24 between sections, 10 from a heading to its card.
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xs, gap: 24 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  card: { borderRadius: 22 },
  cardPad: { padding: 16, gap: 12 },
  rowPad: { padding: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  // Full width: undoes the page's side and top padding.
  band: {
    marginHorizontal: -Spacing.lg,
    marginTop: -Spacing.xs,
    paddingHorizontal: 20,
    paddingBottom: 28,
    alignItems: 'center',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  bandBleed: { position: 'absolute', left: 0, right: 0, top: -600, height: 600 },
  bandTop: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  bandTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.6 },
  bandButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  avatarsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  avatarRing: { borderWidth: 4, borderRadius: AVATAR / 2 + 4 },
  avatarLink: { marginHorizontal: -10, zIndex: 2, transform: [{ translateY: -12 }] },
  cameraBadge: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 3,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyAvatar: {
    width: AVATAR + 8,
    height: AVATAR + 8,
    borderRadius: AVATAR / 2 + 4,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  names: { fontSize: 34, fontWeight: '900', letterSpacing: -0.8, marginTop: 16, textAlign: 'center' },
  since: { fontSize: 16, fontWeight: '600', marginTop: 6, textAlign: 'center' },


  heroButtons: { flexDirection: 'row', gap: 8, marginTop: 16, alignSelf: 'stretch' },
  pillBtn: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  pillBtnText: { fontSize: 14, fontWeight: '700', flexShrink: 1 },

  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', gap: 2 },
  statValueRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statValue: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  statLabel: { fontSize: 12, fontWeight: '700' },

  tile: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  smallTile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  small: { fontSize: 13, fontWeight: '600' },
  levelBubble: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  levelNum: { fontSize: 18, fontWeight: '900' },
  levelText: { gap: 4 },
  trackThin: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
  plusTile: { backgroundColor: 'rgba(255,255,255,0.2)' },
  tryBtn: { height: 34, paddingHorizontal: 16, borderRadius: 17, justifyContent: 'center' },
  tryText: { fontSize: 14, fontWeight: '800' },

  body: { fontSize: 14, lineHeight: 20 },
  codeBox: {
    height: 64,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  code: { fontSize: 28, fontWeight: '800', letterSpacing: 6 },
  primaryBtn: { height: 52, borderRadius: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryBtnText: { fontSize: 16, fontWeight: '800' },
  rowLabel: { flex: 1, fontSize: 16, fontWeight: '600' },
  note: { fontSize: 13, lineHeight: 18, paddingHorizontal: 6 },
});
