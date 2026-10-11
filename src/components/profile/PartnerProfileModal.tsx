import { useQuery } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
    ActivityIndicator,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { GestureHandlerRootView, Gesture, GestureDetector, Pressable } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PartnerStatusLine } from '@/components/chat/PartnerStatusLine';
import { SwipeBackSheet } from '@/components/layout/SwipeBackSheet';
import { LocationMapPreview } from '@/components/moments/LocationMapPreview';
import { FullScreenImageModal } from '@/components/ui/FullScreenImageModal';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar, colorWithAlpha } from '@/components/ui/primitives';
import { MOOD_COLORS, MOOD_EMOJI, MOOD_LABELS } from '@/constants/design-system';
import { useMoods, useStreak } from '@/hooks/queries';
import { usePartnerActiveMoments } from '@/hooks/usePartnerActiveMoments';
import { usePartnerPresence } from '@/hooks/usePartnerPresence';
import { buildSharedLocationMarkers, usePartnerLocationRealtime } from '@/hooks/useSharedLocationMap';
import { useStartCall } from '@/hooks/useStartCall';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { filterMomentsForHome, momentHasVisual } from '@/lib/moment-display';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type { MoodType, UserProfile } from '@/types/database';

const SCREEN_PAD = 20;
const DRAG_DISMISS_DISTANCE = 100;
const DRAG_DISMISS_VELOCITY = 800;

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
  const openPartnerLocationMap = useUIStore((s) => s.openPartnerLocationMap);

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

  const dragY = useSharedValue(0);

  useEffect(() => {
    if (visible) dragY.value = 0;
  }, [visible, dragY]);

  const partnerTyping = profile?.id ? typingUsers.includes(profile.id) : false;
  const partnerMood = profile?.id ? moods?.[profile.id]?.mood ?? null : null;

  const sinceLabel = useMemo(() => {
    if (!relationship?.created_at) return null;
    return { long: format(new Date(relationship.created_at), 'MMMM d, yyyy') };
  }, [relationship?.created_at]);

  const close = () => {
    setShowAvatar(false);
    closePartnerProfile();
  };

  const leaveProfile = (next?: () => void) => {
    close();
    if (next) {
      setTimeout(next, 0);
    }
  };

  const goToChat = () => {
    leaveProfile(() => router.push('/chat'));
  };

  const dragHandlePan = Gesture.Pan()
    .onUpdate((event) => {
      dragY.value = event.translationY > 0 ? event.translationY : event.translationY * 0.2;
    })
    .onEnd((event) => {
      const shouldDismiss =
        event.translationY > DRAG_DISMISS_DISTANCE || event.velocityY > DRAG_DISMISS_VELOCITY;

      if (shouldDismiss) {
        dragY.value = withTiming(900, { duration: 220, easing: Easing.in(Easing.cubic) }, (finished) => {
          if (finished) runOnJS(close)();
        });
        return;
      }

      dragY.value = withSpring(0, { damping: 24, stiffness: 280 });
    });

  const dragSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));

  const openMomentsHistory = () => {
    leaveProfile(() => {
      setMomentHistoryReturnToCamera(false);
      setShowMomentHistory(true);
    });
  };

  const sendMoment = () => {
    leaveProfile(() => setShowMomentCreator(true));
  };

  const openFullMap = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Close this pageSheet first, same as every other full-screen flow launched from the
    // profile (call, moment creator, history) — the map then opens as its own independent,
    // true full-screen Modal instead of being confined to the sheet's smaller frame.
    leaveProfile(() => openPartnerLocationMap(locationMarkers, mapTitle));
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
    openMomentViewer(recentPartnerMoments, 0, {
      playback: 'story',
      sectionLabel: `${getFirstName(partnerName) ?? 'Partner'}'s moment`,
      returnToPartnerProfile: true,
    });
  };

  const viewProfilePhoto = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowAvatar(true);
  };

  const onAvatarPress = () => {
    viewProfilePhoto();
  };

  const onAvatarLongPress = () => {
    if (hasPartnerMoment) {
      viewPartnerMoment();
      return;
    }
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

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={close}
        onDismiss={close}>
        <GestureHandlerRootView style={[styles.root, { backgroundColor: colors.background }]}>
        <Animated.View style={[styles.root, { backgroundColor: colors.background }, dragSheetStyle]}>
          {!profile && isLoadingPartner ? (
            <View style={[styles.loadingState, { paddingTop: insets.top + 24 }]}>
              <ActivityIndicator size="large" color={colors.accent} />
            </View>
          ) : !profile ? (
            <View style={[styles.loadingState, { paddingTop: insets.top + 24 }]}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {isPartnerError
                  ? 'Could not load partner profile.'
                  : partnerId
                    ? 'Loading partner profile…'
                    : 'Your partner has not joined yet.'}
              </Text>
            </View>
          ) : (
          <SwipeBackSheet onDismiss={close}>
            <GestureDetector gesture={dragHandlePan}>
              <LinearGradient
                colors={colors.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.dragHandleTouchTarget}
                hitSlop={{ top: 10, bottom: 10, left: 30, right: 30 }}>
                <View style={[styles.dragHandle, { backgroundColor: colorWithAlpha(colors.onAccent, 0.45) }]} />
              </LinearGradient>
            </GestureDetector>

            <ScrollView
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
              <LinearGradient
                colors={colors.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.heroBleed}>
                <View style={[styles.screenInset, styles.heroInner]}>
              <Pressable
                onPress={onAvatarPress}
                onLongPress={onAvatarLongPress}
                delayLongPress={400}
                disabled={!hasPartnerMoment && !profile.avatar_url?.trim() && !profile.name?.trim()}
                style={styles.avatarPress}
                accessibilityRole="button"
                accessibilityHint={
                  hasPartnerMoment ? 'Long press to view moment' : 'View profile photo'
                }
                accessibilityLabel={
                  profile.avatar_url ? 'View profile photo' : 'Profile photo'
                }>
                {hasPartnerMoment ? (
                  <LinearGradient
                    colors={['#5b8def', '#9b6bff', '#e85d75']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.avatarStoryRing}>
                    <View style={styles.avatarStoryInner}>
                      <View style={styles.avatarStoryClip}>
                        {storyPreviewUrl ? (
                          <Image
                            source={{ uri: storyPreviewUrl }}
                            style={styles.avatarStoryImage}
                            contentFit="cover"
                          />
                        ) : (
                          <Avatar
                            name={profile.name}
                            imageUrl={profile.avatar_url}
                            size={104}
                            colorsOverride={['#ffffff', '#ffffff']}
                          />
                        )}
                      </View>
                    </View>
                    {isOnline && (
                      <View
                        style={[
                          styles.onlineDot,
                          { backgroundColor: colors.success, borderColor: colors.onAccent },
                        ]}
                      />
                    )}
                  </LinearGradient>
                ) : (
                  <View style={[styles.avatarRing, { borderColor: colorWithAlpha(colors.onAccent, 0.35) }]}>
                    <Avatar
                      name={profile.name}
                      imageUrl={profile.avatar_url}
                      size={108}
                      colorsOverride={['#ffffff', '#ffffff']}
                    />
                    {isOnline && (
                      <View
                        style={[
                          styles.onlineDot,
                          { backgroundColor: colors.success, borderColor: colors.onAccent },
                        ]}
                      />
                    )}
                  </View>
                )}
              </Pressable>

              {hasPartnerMoment ? (
                <Text style={[styles.avatarHint, { color: colorWithAlpha(colors.onAccent, 0.78) }]}>
                  Tap for moment · Hold for photo
                </Text>
              ) : null}

              <Text style={[styles.heroName, { color: colors.onAccent }]}>{partnerName}</Text>

              <View style={[styles.heroStatus, { backgroundColor: colorWithAlpha(colors.onAccent, 0.16) }]}>
                <PartnerStatusLine
                  isTyping={partnerTyping}
                  isOnline={isOnline}
                  lastSeenAt={lastSeenAt}
                  statusHidden={statusHidden}
                  textStyle={{ fontSize: 13, fontWeight: '600', color: colors.onAccent }}
                />
              </View>
                </View>
              </LinearGradient>

            <View style={[styles.screenInset, styles.body]}>
              <View style={styles.actions}>
                <ActionTile icon="messages" label="Message" onPress={goToChat} colors={colors} />
                <ActionTile icon="call" label="Call" onPress={startVoiceCall} colors={colors} />
                <ActionTile icon="videocam" label="Video" onPress={startVideoCall} colors={colors} />
                <ActionTile icon="camera" label="Moment" onPress={sendMoment} colors={colors} />
              </View>

              <InfoCard title="Today's mood" colors={colors}>
                {partnerMood ? (
                  <MoodRow mood={partnerMood as MoodType} colors={colors} />
                ) : (
                  <Text style={[styles.muted, { color: colors.textSecondary }]}>
                    {getFirstName(partnerName)} hasn&apos;t shared a mood yet today.
                  </Text>
                )}
              </InfoCard>

              {showLocation ? (
                <InfoCard title="Location" colors={colors}>
                  {locationMarkers.length > 0 ? (
                    <>
                      <LocationMapPreview
                        markers={locationMarkers}
                        height={168}
                        onPress={openFullMap}
                      />
                    </>
                  ) : null}
                  {locationLabel ? (
                    locationMarkers.length > 0 ? (
                      <Pressable onPress={openFullMap} style={[styles.locationRow, styles.locationRowSpaced]}>
                        <View style={[styles.locationIcon, { backgroundColor: colors.accentSoft }]}>
                          <Icon name="location" size={18} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.locationText, { color: colors.text }]}>{locationLabel}</Text>
                          {locationFreshness ? (
                            <Text style={[styles.locationMeta, { color: colors.textTertiary }]}>
                              {locationFreshness}
                            </Text>
                          ) : null}
                        </View>
                      </Pressable>
                    ) : (
                      <View style={styles.locationRow}>
                        <View style={[styles.locationIcon, { backgroundColor: colors.accentSoft }]}>
                          <Icon name="location" size={18} color={colors.accent} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.locationText, { color: colors.text }]}>{locationLabel}</Text>
                          {locationFreshness ? (
                            <Text style={[styles.locationMeta, { color: colors.textTertiary }]}>
                              {locationFreshness}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    )
                  ) : null}
                </InfoCard>
              ) : null}

              <InfoCard title="Your connection" colors={colors}>
                <DetailRow
                  icon="fire"
                  label="Current streak"
                  value={streakCount != null ? `${streakCount} days` : '—'}
                  colors={colors}
                />
                {sinceLabel ? (
                  <DetailRow
                    icon="heart"
                    label="Together since"
                    value={sinceLabel.long}
                    colors={colors}
                  />
                ) : null}
              </InfoCard>

              <Pressable
                onPress={openMomentsHistory}
                style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Icon name="camera" size={18} color={colors.accent} />
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Moments history</Text>
                <Icon name="chevronRight" size={18} color={colors.textTertiary} />
              </Pressable>
            </View>
            </ScrollView>
          </SwipeBackSheet>
          )}
        </Animated.View>
        </GestureHandlerRootView>
      </Modal>

      <FullScreenImageModal
        visible={showAvatar}
        imageUrl={profile?.avatar_url}
        fallbackName={profile?.name}
        title={partnerName}
        onClose={() => setShowAvatar(false)}
      />
    </>
  );
}

function ActionTile({
  icon,
  label,
  onPress,
  colors,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  colors: { accent: string; surface: string; border: string; text: string };
}) {
  return (
    <Pressable
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[styles.actionTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.actionIcon, { backgroundColor: colors.accent + '18' }]}>
        <Icon name={icon} size={20} color={colors.accent} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

function InfoCard({
  title,
  children,
  colors,
}: {
  title: string;
  children: ReactNode;
  colors: { text: string; surface: string; border: string };
}) {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

function MoodRow({ mood, colors }: { mood: MoodType; colors: { text: string } }) {
  const tint = MOOD_COLORS[mood] ?? colors.text;
  return (
    <View style={styles.moodRow}>
      <View style={[styles.moodBadge, { backgroundColor: tint + '22' }]}>
        <Text style={styles.moodEmoji}>{MOOD_EMOJI[mood] ?? '✨'}</Text>
      </View>
      <Text style={[styles.moodLabel, { color: colors.text }]}>{MOOD_LABELS[mood] ?? mood}</Text>
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: IconName;
  label: string;
  value: string;
  colors: { text: string; textSecondary: string; accentSoft: string; accent: string };
}) {
  return (
    <View style={styles.detailRow}>
      <View style={[styles.detailIcon, { backgroundColor: colors.accentSoft }]}>
        <Icon name={icon} size={16} color={colors.accent} />
      </View>
      <Text style={[styles.detailLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },
  screenInset: {
    paddingHorizontal: SCREEN_PAD,
    width: '100%',
  },
  heroInner: {
    alignItems: 'center',
    paddingTop: 12,
  },
  heroBleed: {
    width: '100%',
    paddingBottom: 28,
  },
  dragHandleTouchTarget: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 10,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  avatarPress: { marginBottom: 14 },
  avatarStoryRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarStoryInner: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  avatarStoryClip: {
    width: 112,
    height: 112,
    borderRadius: 56,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarStoryImage: {
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  avatarHint: {
    marginTop: -6,
    marginBottom: 10,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  avatarRing: {
    padding: 4,
    borderRadius: 999,
    borderWidth: 2,
    position: 'relative',
  },
  onlineDot: {
    position: 'absolute',
    right: 11,
    bottom: 11,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    zIndex: 2,
    elevation: 2,
  },
  heroName: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  heroStatus: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  body: { paddingTop: 20, gap: 14, alignSelf: 'stretch' },
  actions: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  actionTile: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: { fontSize: 11, fontWeight: '700' },
  card: {
    alignSelf: 'stretch',
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  cardTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  muted: { fontSize: 15, lineHeight: 22 },
  moodRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  moodBadge: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodEmoji: { fontSize: 24 },
  moodLabel: { fontSize: 18, fontWeight: '700' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  locationRowSpaced: { marginTop: 12 },
  locationIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationText: { fontSize: 16, fontWeight: '600' },
  locationMeta: { fontSize: 12, marginTop: 2 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailLabel: { flex: 1, fontSize: 14, fontWeight: '500' },
  detailValue: { fontSize: 14, fontWeight: '700', textAlign: 'right', flexShrink: 1, marginLeft: 12 },
  secondaryBtn: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  secondaryBtnText: { flex: 1, fontSize: 15, fontWeight: '600' },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  loadingText: { fontSize: 16, textAlign: 'center', lineHeight: 24 },
});
