import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import * as Haptics from '@/lib/haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
// Gesture-aware ScrollView: scrolls cleanly inside the page's swipe-back gesture.
import { Pressable, ScrollView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PartnerStatusLine } from '@/components/chat/PartnerStatusLine';
import { MomentsModal } from '@/components/moments/MomentsModal';
import { StreakFlame } from '@/components/home/StreakFlame';
import { FullScreenPage } from '@/components/layout/FullScreenPage';
import { LocationMapPreview } from '@/components/moments/LocationMapPreview';
import { FullScreenLocationMapModal } from '@/components/profile/FullScreenLocationMapModal';
import { FullScreenImageModal } from '@/components/ui/FullScreenImageModal';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar, colorWithAlpha } from '@/components/ui/primitives';
import { MOOD_COLORS, MOOD_EMOJI, MOOD_LABELS, type ThemeColors } from '@/constants/design-system';
import { useMoods, useStreak } from '@/hooks/queries';
import { usePartnerActiveMoments } from '@/hooks/usePartnerActiveMoments';
import { usePartnerPresence } from '@/hooks/usePartnerPresence';
import { buildSharedLocationMarkers, usePartnerLocationRealtime } from '@/hooks/useSharedLocationMap';
import { useStartCall } from '@/hooks/useStartCall';
import { useTheme } from '@/hooks/useTheme';
import { getAnniversaryCountdown, getRelationshipAnniversaryDate, getRelationshipAnniversaryIso } from '@/lib/anniversary';
import { getFirstName } from '@/lib/avatar-initial';
import { formatDistanceApart, haversineDistanceKm } from '@/lib/distance';
import { hasValidCoords } from '@/lib/location';
import { formatPartnerClock } from '@/lib/partner-header-line';
import { filterMomentsForHome, momentHasVisual } from '@/lib/moment-display';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type { UserProfile } from '@/types/database';

/** Let this page finish sliding away before the next full-screen thing opens. */
const HANDOFF_MS = 260;

export function PartnerProfileModal() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const visible = useUIStore((s) => s.showPartnerProfile);
  const closePartnerProfile = useUIStore((s) => s.closePartnerProfile);
  const typingUsers = useUIStore((s) => s.typingUsers);
  const setShowMomentHistory = useUIStore((s) => s.setShowMomentHistory);
  const setMomentHistoryReturnToCamera = useUIStore((s) => s.setMomentHistoryReturnToCamera);
  const setShowMomentCreator = useUIStore((s) => s.setShowMomentCreator);
  const openMomentViewer = useUIStore((s) => s.openMomentViewer);

  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const setPartner = useRelationshipStore((s) => s.setPartner);
  const relationship = useRelationshipStore((s) => s.relationship);

  const partnerId = useMemo(() => {
    if (!relationship || !user) return null;
    return relationship.user_1_id === user.id ? relationship.user_2_id : relationship.user_1_id;
  }, [relationship, user]);

  const { data: fetchedPartner, isLoading: isLoadingPartner, isError: isPartnerError } = useQuery({
    queryKey: ['partnerProfile', partnerId],
    queryFn: () => api.fetchProfile(partnerId!),
    enabled: visible && !!partnerId,
  });

  useEffect(() => {
    if (fetchedPartner) setPartner(fetchedPartner);
  }, [fetchedPartner, setPartner]);

  const profile: UserProfile | null = fetchedPartner ?? partner ?? null;

  usePartnerLocationRealtime();

  const { data: moods } = useMoods();
  const { data: streak } = useStreak();
  const partnerActiveMoments = usePartnerActiveMoments();
  const recentPartnerMoments = useMemo(
    () => filterMomentsForHome(partnerActiveMoments),
    [partnerActiveMoments],
  );
  const hasPartnerMoment = recentPartnerMoments.length > 0;
  const startCall = useStartCall();
  const { isOnline, lastSeenAt, statusHidden } = usePartnerPresence(
    relationship?.id,
    user?.id,
    profile?.id ?? partnerId ?? undefined,
  );

  const [showAvatar, setShowAvatar] = useState(false);

  const partnerTyping = profile?.id ? typingUsers.includes(profile.id) : false;
  const partnerMood = profile?.id ? moods?.[profile.id]?.mood ?? null : null;

  const sinceLabel = useMemo(() => {
    if (!relationship?.created_at) return null;
    const since = getRelationshipAnniversaryDate(relationship);
    return { long: format(since, 'MMMM d, yyyy'), short: format(since, 'd MMM yyyy') };
  }, [relationship]);

  // The full map opens over this page (not as its own layer), so closing it lands
  // straight back here instead of flashing the screen underneath first.
  const [showMap, setShowMap] = useState(false);

  const close = () => {
    setShowAvatar(false);
    setShowMap(false);
    closePartnerProfile();
  };

  const leaveProfile = (next?: () => void) => {
    close();
    if (next) {
      setTimeout(next, HANDOFF_MS);
    }
  };

  const goToChat = () => {
    leaveProfile(() => router.push('/chat'));
  };

  // Moments open right over the profile (it hosts them while it's open): no stop at
  // Home on the way, and closing them comes back here.
  const openMomentsHistory = () => {
    setMomentHistoryReturnToCamera(false);
    setShowMomentHistory(true);
  };

  const sendMoment = () => {
    setShowMomentCreator(true);
  };

  const openFullMap = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowMap(true);
  };

  const startVoiceCall = () => {
    leaveProfile(() => {
      void startCall('audio');
    });
  };

  const startVideoCall = () => {
    leaveProfile(() => {
      void startCall('video');
    });
  };

  const viewPartnerMoment = () => {
    if (recentPartnerMoments.length === 0) {
      viewProfilePhoto();
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Opens over the profile (which hosts Moments while it's open); closing it lands back here.
    openMomentViewer(recentPartnerMoments, 0, {
      playback: 'story',
      sectionLabel: `${getFirstName(partnerName) ?? 'Partner'}'s moment`,
    });
  };

  const viewProfilePhoto = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowAvatar(true);
  };

  const onAvatarPress = () => {
    viewProfilePhoto();
  };

  const iShareLocation = Boolean(user?.location_sharing_enabled);
  const partnerName = profile?.name ?? 'Partner';
  const locationLabel =
    iShareLocation && profile?.location_sharing_enabled
      ? profile.location_label?.trim()
      : null;
  const streakCount = streak?.current_streak;

  const locationMarkers = useMemo(
    () => buildSharedLocationMarkers(user, profile ?? partner),
    [user, profile, partner],
  );

  const showLocation =
    iShareLocation &&
    profile?.location_sharing_enabled &&
    (locationMarkers.length > 0 || !!locationLabel);

  const mapTitle = locationLabel ?? partnerName;

  const locationFreshness = useMemo(() => {
    if (!profile?.location_updated_at) return null;
    const updated = new Date(profile.location_updated_at);
    if (Number.isNaN(updated.getTime())) return null;
    const ageMs = Date.now() - updated.getTime();
    if (ageMs > 24 * 60 * 60 * 1000) return null;
    return formatDistanceToNow(updated, { addSuffix: true });
  }, [profile?.location_updated_at]);

  const latestPartnerMoment = recentPartnerMoments[0];
  const storyPreviewUrl =
    latestPartnerMoment && momentHasVisual(latestPartnerMoment)
      ? latestPartnerMoment.media_url
      : profile?.avatar_url;

  const latestMomentAgo = latestPartnerMoment
    ? formatDistanceToNow(new Date(latestPartnerMoment.created_at), { addSuffix: true })
    : null;
  const moodLog = profile?.id ? moods?.[profile.id] : undefined;
  const moodAgo = moodLog?.created_at ? formatDistanceToNow(new Date(moodLog.created_at), { addSuffix: true }) : null;

  const sharesLocation = Boolean(user?.location_sharing_enabled && profile?.location_sharing_enabled);
  const distanceApart = useMemo(() => {
    if (!sharesLocation) return null;
    if (!hasValidCoords(user?.location_latitude, user?.location_longitude)) return null;
    if (!hasValidCoords(profile?.location_latitude, profile?.location_longitude)) return null;
    return formatDistanceApart(
      haversineDistanceKm(
        { latitude: user!.location_latitude!, longitude: user!.location_longitude! },
        { latitude: profile!.location_latitude!, longitude: profile!.location_longitude! },
      ),
    );
  }, [sharesLocation, user, profile]);
  const clock = formatPartnerClock(profile?.timezone);

  const anniversary = relationship?.created_at
    ? getAnniversaryCountdown(getRelationshipAnniversaryIso(relationship))
    : null;
  const { data: momentCount } = useQuery({
    queryKey: ['momentCount', relationship?.id],
    queryFn: () => api.countMoments(relationship!.id),
    enabled: visible && !!relationship?.id,
  });
  const firstName = getFirstName(partnerName) ?? 'Partner';
  const surface = cardSurface(colors);
  const tileBg = colors.boldBorder ? colors.backgroundElevated : colors.surfaceElevated;
  // The top, like the You page: a band of the theme's hero colour with its own text colour.
  const band = colors.hero ? colors.hero[0] : colors.gradient[0];
  const onBand = colors.onHero ?? colors.onGradient;
  const onBandSoft = colorWithAlpha(onBand, 0.82);
  const bandChip = { backgroundColor: colorWithAlpha(onBand, 0.16) };

  return (
    <>
      {/* A full page, like Chat itself: slides in from the right, back arrow at
          the top, swipe right anywhere (or Android back) to close. */}
      <FullScreenPage
        visible={visible}
        title=""
        onBack={close}
        floatingBack={!!profile}
        headerTint={profile ? onBand : undefined}
       
        overlay={
          <>
            <FullScreenLocationMapModal
              inline
              visible={showMap}
              markers={locationMarkers}
              title={mapTitle}
              onClose={() => setShowMap(false)}
            />
            {/* Moments, presented from inside this page so they open over it (see AppModals). */}
            <MomentsModal />
          </>
        }>
        {!profile && isLoadingPartner ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
        ) : !profile ? (
          <View style={styles.loadingState}>
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              {isPartnerError
                ? 'Could not load your partner’s profile.'
                : partnerId
                  ? 'Loading…'
                  : 'Your partner hasn’t joined yet.'}
            </Text>
          </View>
        ) : (
          <ScrollView
            style={styles.flex}
            showsVerticalScrollIndicator={false}
            // The band meets the header: no pulling the page down to open a gap between them.
            bounces={false}
            overScrollMode="never"
            contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 16 }]}>
            {/* Who: photo (story ring when they've posted today), name, status, their time + distance. */}
            <View style={[styles.hero, { backgroundColor: band, paddingTop: insets.top + 56 }]}>
              <Pressable
                onPress={hasPartnerMoment ? viewPartnerMoment : onAvatarPress}
                onLongPress={viewProfilePhoto}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityLabel={hasPartnerMoment ? `View ${firstName}’s moment` : 'View profile photo'}
                accessibilityHint={hasPartnerMoment ? 'Hold to see the profile photo' : undefined}>
                {hasPartnerMoment ? (
                  <LinearGradient
                    // Flat theme colour on the soft themes (no gradients there).
                    colors={colors.sticker ? [colors.highlight, colors.highlight] : ['#5b8def', '#9b6bff', '#e85d75']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.storyRing}>
                    <View style={[styles.storyGap, { backgroundColor: band }]}>
                      {storyPreviewUrl ? (
                        <Image source={{ uri: storyPreviewUrl }} style={styles.storyImage} contentFit="cover" />
                      ) : (
                        <Avatar name={profile.name} imageUrl={profile.avatar_url} size={112} />
                      )}
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={[styles.avatarRing, { borderColor: colors.background }]}>
                    <Avatar name={profile.name} imageUrl={profile.avatar_url} size={112} />
                  </View>
                )}
                {isOnline ? (
                  <View style={[styles.onlineDot, { backgroundColor: colors.success, borderColor: band }]} />
                ) : null}
              </Pressable>
              {hasPartnerMoment ? (
                <Text style={[styles.hint, { color: onBandSoft }]}>Tap for today’s moment · hold for photo</Text>
              ) : null}

              <Text style={[styles.name, { color: onBand }]} numberOfLines={1}>
                {partnerName}
              </Text>
              <PartnerStatusLine
                isTyping={partnerTyping}
                isOnline={isOnline}
                lastSeenAt={lastSeenAt}
                statusHidden={statusHidden}
                textStyle={{ fontSize: 14, fontWeight: '700', color: onBandSoft }}
              />

              {clock || distanceApart ? (
                <View style={styles.chips}>
                  {clock ? (
                    <View style={[styles.chip, bandChip]}>
                      <Icon name={clock.isOvernight ? 'moon' : 'time'} size={15} color={onBand} />
                      <Text style={[styles.chipText, { color: onBand }]}>{clock.time} their time</Text>
                    </View>
                  ) : null}
                  {distanceApart ? (
                    <View style={[styles.chip, bandChip]}>
                      <Icon name="location" size={15} color={onBand} />
                      <Text style={[styles.chipText, { color: onBand }]}>{distanceApart}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>

            {/* Do: message (the main one), call, video, send a moment. */}
            <View style={styles.actions}>
              <RoundAction icon="messages" label="Message" onPress={goToChat} primary />
              <RoundAction icon="call" label="Call" onPress={startVoiceCall} />
              <RoundAction icon="videocam" label="Video" onPress={startVideoCall} />
              <RoundAction icon="camera" label="Moment" onPress={sendMoment} />
            </View>

            <Section title="Right now">
              <View style={[styles.card, styles.row, styles.rowPad, surface]}>
                {partnerMood ? (
                  <>
                    <View style={[styles.moodBadge, { backgroundColor: (MOOD_COLORS[partnerMood] ?? colors.accent) + '26' }]}>
                      <Text style={styles.moodEmoji}>{MOOD_EMOJI[partnerMood] ?? '✨'}</Text>
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.kicker, { color: colors.textSecondary }]}>Feeling</Text>
                      <Text style={[styles.bigLabel, { color: colors.text }]}>{MOOD_LABELS[partnerMood] ?? partnerMood}</Text>
                    </View>
                    {moodAgo ? <Text style={[styles.meta, { color: colors.textTertiary }]}>{moodAgo}</Text> : null}
                  </>
                ) : (
                  <>
                    <View style={[styles.moodBadge, { backgroundColor: tileBg }]}>
                      <Icon name="happy" size={24} color={colors.textSecondary} />
                    </View>
                    <Text style={[styles.flex, styles.muted, { color: colors.textSecondary }]}>
                      {firstName} hasn’t shared a mood yet today.
                    </Text>
                  </>
                )}
              </View>

              {latestPartnerMoment ? (
                <Pressable
                  onPress={viewPartnerMoment}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.card, styles.row, styles.momentRow, surface, pressed && styles.pressed]}>
                  {momentHasVisual(latestPartnerMoment) && latestPartnerMoment.media_url ? (
                    <Image source={{ uri: latestPartnerMoment.media_url }} style={styles.momentThumb} contentFit="cover" />
                  ) : (
                    <View style={[styles.momentThumb, styles.center, { backgroundColor: tileBg }]}>
                      <Icon name="camera" size={22} color={colors.textSecondary} />
                    </View>
                  )}
                  <View style={styles.flex}>
                    <Text style={[styles.kicker, { color: colors.textSecondary }]}>Today’s moment</Text>
                    {latestPartnerMoment.content?.trim() ? (
                      <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
                        “{latestPartnerMoment.content.trim()}”
                      </Text>
                    ) : (
                      <Text style={[styles.rowTitle, { color: colors.text }]}>Tap to view</Text>
                    )}
                    {latestMomentAgo ? <Text style={[styles.meta, { color: colors.textTertiary }]}>{latestMomentAgo}</Text> : null}
                  </View>
                  <Icon name="chevronRight" size={16} color={colors.textTertiary} />
                </Pressable>
              ) : null}
            </Section>

            {showLocation ? (
              <Section title="Where they are">
                <View style={[styles.card, styles.clip, surface]}>
                  {locationMarkers.length > 0 ? (
                    <LocationMapPreview markers={locationMarkers} height={150} onPress={openFullMap} />
                  ) : null}
                  <Pressable onPress={openFullMap} style={({ pressed }) => [styles.row, styles.rowPad, pressed && styles.pressed]}>
                    <View style={[styles.smallTile, { backgroundColor: tileBg }]}>
                      <Icon name="location" size={18} color={colors.text} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                        {locationLabel || 'Open map'}
                      </Text>
                      {locationFreshness ? (
                        <Text style={[styles.meta, { color: colors.textTertiary }]}>Updated {locationFreshness}</Text>
                      ) : null}
                    </View>
                    <Icon name="chevronRight" size={16} color={colors.textTertiary} />
                  </Pressable>
                </View>
              </Section>
            ) : null}

            <Section title="The two of you">
              <View style={[styles.card, styles.list, surface]}>
                <InfoRow
                  icon={<StreakFlame size={20} tone={streakCount ? 'active' : 'idle'} />}
                  label="Streak"
                  value={`${streakCount ?? 0} day${streakCount === 1 ? '' : 's'}`}
                />
                {sinceLabel ? (
                  <InfoRow icon={<Icon name="heart" size={19} color={colors.text} />} label="Together since" value={sinceLabel.short} />
                ) : null}
                {anniversary ? (
                  <InfoRow
                    icon={<Icon name="calendar" size={19} color={colors.text} />}
                    label={anniversary.daysUntil === 0 ? 'Anniversary' : 'Anniversary in'}
                    value={anniversary.daysUntil === 0 ? 'Today 🎉' : `${anniversary.daysUntil} days`}
                  />
                ) : null}
                <InfoRow
                  icon={<Icon name="camera" size={19} color={colors.text} />}
                  label="Moments shared"
                  value={momentCount != null ? momentCount.toLocaleString() : '…'}
                  last
                />
              </View>
            </Section>

            <Pressable
              onPress={openMomentsHistory}
              accessibilityRole="button"
              style={({ pressed }) => [styles.card, styles.row, styles.rowPad, surface, pressed && styles.pressed]}>
              <View style={[styles.smallTile, { backgroundColor: tileBg }]}>
                <Icon name="albums" size={19} color={colors.text} />
              </View>
              <Text style={[styles.flex, styles.rowLabel, { color: colors.text }]}>Moments history</Text>
              <Icon name="chevronRight" size={16} color={colors.textTertiary} />
            </Pressable>
          </ScrollView>
        )}

        {/* Inside the profile's own Modal: on iPhone one opened beside it never shows. */}
        <FullScreenImageModal
          visible={showAvatar}
          imageUrl={profile?.avatar_url}
          fallbackName={profile?.name}
          title={partnerName}
          onClose={() => setShowAvatar(false)}
        />
      </FullScreenPage>

    </>
  );
}

/** A card's fill, plus the theme's border where cards need one (Paper). */
function cardSurface(colors: ThemeColors) {
  return { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: colors.boldBorder ? 2 : colors.sticker ? 1 : 0 };
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

/** Round action button with its label underneath (like Contacts). */
function RoundAction({ icon, label, onPress, primary }: { icon: IconName; label: string; onPress: () => void; primary?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
      <View
        style={[
          styles.actionCircle,
          primary
            ? { backgroundColor: colors.accent }
            : cardSurface(colors),
        ]}>
        <Icon name={icon} size={24} color={primary ? colors.onAccent : colors.text} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function InfoRow({ icon, label, value, last }: { icon: ReactNode; label: string; value: string; last?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.infoRow}>
      <View style={[styles.smallTile, { backgroundColor: colors.boldBorder ? colors.backgroundElevated : colors.surfaceElevated }]}>
        {icon}
      </View>
      <View
        style={[
          styles.infoBody,
          !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
        ]}>
        <Text style={[styles.rowLabel, styles.flex, { color: colors.text }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.textSecondary }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.75 },
  // Same rhythm as Home, You and Settings: 24 between sections, 10 inside.
  scroll: { paddingHorizontal: 16, paddingTop: 4, gap: 24 },
  section: { gap: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  card: { borderRadius: 22 },
  clip: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowPad: { padding: 14 },
  list: { overflow: 'hidden', paddingVertical: 2 },

  // Full width (undoes the page's side and top padding), curved at the bottom like the You page.
  hero: {
    alignItems: 'center',
    gap: 6,
    marginHorizontal: -16,
    marginTop: -4,
    paddingHorizontal: 20,
    paddingBottom: 26,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  avatarRing: { borderWidth: 4, borderRadius: 60 },
  storyRing: { width: 128, height: 128, borderRadius: 64, alignItems: 'center', justifyContent: 'center' },
  storyGap: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  storyImage: { width: 112, height: 112, borderRadius: 56 },
  onlineDot: { position: 'absolute', right: 8, bottom: 8, width: 22, height: 22, borderRadius: 11, borderWidth: 4 },
  hint: { fontSize: 13, fontWeight: '700', marginTop: 4 },
  name: { fontSize: 30, fontWeight: '900', letterSpacing: -0.6, marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  chip: { height: 32, paddingHorizontal: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: 13, fontWeight: '700' },

  actions: { flexDirection: 'row', justifyContent: 'space-between' },
  action: { flex: 1, alignItems: 'center', gap: 8 },
  actionCircle: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: 13, fontWeight: '700' },

  moodBadge: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  moodEmoji: { fontSize: 28 },
  kicker: { fontSize: 13, fontWeight: '800' },
  bigLabel: { fontSize: 18, fontWeight: '800' },
  meta: { fontSize: 13, fontWeight: '600' },
  muted: { fontSize: 15, lineHeight: 21 },
  momentRow: { padding: 10, paddingRight: 14 },
  momentThumb: { width: 64, height: 80, borderRadius: 14 },
  rowTitle: { fontSize: 16, fontWeight: '800' },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  smallTile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  infoRow: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14 },
  infoBody: { flex: 1, minHeight: 54, marginLeft: 12, paddingRight: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  infoValue: { fontSize: 15, fontWeight: '700', maxWidth: '50%' },

  loadingState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  loadingText: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
});
