import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from '@/lib/haptics';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    type LayoutChangeEvent,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentVideoPlayer } from '@/components/moments/MomentVideoPlayer';
import { MomentViewerDock } from '@/components/moments/MomentViewerDock';
import { Avatar } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { useDeleteMoments, useMomentReaction, useSendMessage } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { downloadMomentMedia } from '@/lib/download-moment-media';
import { toggleMomentReactionForUser } from '@/lib/moment-display';
import { momentToReplyContext } from '@/lib/moment-reply';
import { viewerChrome } from '@/lib/moment-theme';
import { toUserFacingNetworkError } from '@/lib/network-error';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type { Moment } from '@/types/database';

const STORY_DURATION_MS = 8000;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const DOCK_APPROX = 230;
/** The photo card: nearly full width, portrait like the photos, capped so the dock still fits. */
const CARD_W = SCREEN_W - 20;
const CARD_H = Math.min(Math.round(CARD_W * (4 / 3)), Math.round(SCREEN_H * 0.6));
/** Same feel as closing Our moments: swipe right, same distances and spring. */
const DISMISS_DISTANCE = 72;
const DISMISS_VELOCITY = 650;
const SETTLE_SPRING = { damping: 32, stiffness: 280, mass: 0.9 };

function viewerSessionKey(
  viewer: NonNullable<ReturnType<typeof useUIStore.getState>['momentViewer']>,
) {
  return `${viewer.playback}:${viewer.startIndex}:${viewer.moments.map((m) => m.id).join('|')}`;
}

export function MomentStoryViewer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const chrome = viewerChrome(colors);
  const viewer = useUIStore((s) => s.momentViewer);
  const closeMomentViewer = useUIStore((s) => s.closeMomentViewer);
  const setChatDraft = useUIStore((s) => s.setChatDraft);
  const setChatMomentReply = useUIStore((s) => s.setChatMomentReply);
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const relationship = useRelationshipStore((s) => s.relationship);
  const queryClient = useQueryClient();

  const moments = viewer?.moments ?? [];
  const playback = viewer?.playback ?? 'story';
  const sectionLabel = viewer?.sectionLabel;
  const returnToPartnerProfile = viewer?.returnToPartnerProfile;
  const isFocusMode = playback === 'focus';

  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reply, setReply] = useState('');
  const [width, setWidth] = useState(SCREEN_W);
  const [downloading, setDownloading] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [localReactions, setLocalReactions] = useState<Record<string, Record<string, string[]>>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(0);
  const progressRef = useRef(0);
  const reactMutation = useMomentReaction();
  const sendMessageMutation = useSendMessage();
  const deleteMomentsMutation = useDeleteMoments();

  const sessionKey = viewer ? viewerSessionKey(viewer) : null;
  const activeIndex =
    moments.length === 0 ? 0 : Math.min(Math.max(index, 0), moments.length - 1);
  const baseMoment = moments[activeIndex];

  const moment = useMemo(() => {
    if (!baseMoment) return null;
    const patch = localReactions[baseMoment.id];
    if (!patch) return baseMoment;
    return { ...baseMoment, reactions: patch };
  }, [baseMoment, localReactions]);

  const isMine = !!user && moment?.user_id === user.id;
  const isVideo = moment?.type === 'video' && !!moment.media_url;
  const authorName = isMine ? (user?.name ?? 'You') : (moment?.author?.name ?? partner?.name ?? 'Partner');
  const partnerName = partner?.name ?? 'Partner';
  const timeAgo = moment
    ? formatDistanceToNow(new Date(moment.created_at), { addSuffix: true }).replace('about ', '')
    : '';

  const dismissViewer = useCallback(() => {
    closeMomentViewer();
  }, [closeMomentViewer]);

  useEffect(() => {
    if (!viewer) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      dismissViewer();
      return true;
    });
    return () => sub.remove();
  }, [viewer, dismissViewer]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const goNext = useCallback(() => {
    clearTimer();
    if (activeIndex >= moments.length - 1) {
      dismissViewer();
      return;
    }
    setIndex((i) => Math.min(i + 1, moments.length - 1));
    setProgress(0);
    progressRef.current = 0;
    setReply('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [clearTimer, dismissViewer, activeIndex, moments.length]);

  const goPrev = useCallback(() => {
    clearTimer();
    if (activeIndex <= 0) return;
    setIndex((i) => Math.max(i - 1, 0));
    setProgress(0);
    progressRef.current = 0;
    setReply('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [clearTimer, activeIndex]);

  useEffect(() => {
    if (!viewer || !sessionKey) return;
    setIndex(viewer.startIndex);
    setProgress(0);
    progressRef.current = 0;
    setReply('');
    setPaused(false);
    setLocalReactions({});
  }, [sessionKey, viewer]);

  useEffect(() => {
    if (!viewer || !moment || !user || isMine) return;
    void api
      .markMomentViewed(moment.id, user.id)
      .then(() => {
        queryClient.invalidateQueries({ queryKey: ['moments', relationship?.id] });
      })
      .catch(() => {
        /* non-blocking */
      });
    // keyed on moment?.id/user?.id on purpose: the full `moment` object changes reference on
    // every reaction/refetch, and we only want this to re-fire when the viewed moment or viewer
    // actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, moment?.id, user?.id, isMine, relationship?.id, queryClient]);

  useEffect(() => {
    if (!viewer || !moment || isVideo || paused || isFocusMode) {
      clearTimer();
      return;
    }
    clearTimer();
    startedRef.current = Date.now() - progressRef.current * STORY_DURATION_MS;
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startedRef.current;
      const p = Math.min(1, elapsed / STORY_DURATION_MS);
      progressRef.current = p;
      setProgress(p);
      if (p >= 1) goNext();
    }, 50);
    return clearTimer;
    // keyed on moment?.id on purpose: the full `moment` object changes reference on every
    // reaction/refetch, which would otherwise reset the auto-advance timer whenever an
    // unrelated field on it updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewer, moment?.id, isVideo, paused, isFocusMode, goNext, clearTimer]);

  const react = useCallback(
    (emoji: string) => {
      if (!moment || !user) return;
      const next = toggleMomentReactionForUser(moment.reactions ?? {}, user.id, emoji);
      setLocalReactions((prev) => ({ ...prev, [moment.id]: next }));
      reactMutation.mutate({ momentId: moment.id, emoji });
    },
    [moment, user, reactMutation],
  );

  const sendReply = async () => {
    const text = reply.trim();
    if (!text || !moment) return;
    setSendingReply(true);
    const previewType = moment.type === 'video' ? 'video' : 'image';
    try {
      await sendMessageMutation.mutateAsync({
        content: text,
        momentId: moment.id,
        mediaUrl: moment.media_url ?? undefined,
        mediaType: previewType,
      });
      setReply('');
      dismissViewer();
      router.navigate('/chat');
    } catch {
      setChatDraft(text);
      setChatMomentReply(momentToReplyContext(moment));
      dismissViewer();
      router.navigate('/chat');
    } finally {
      setSendingReply(false);
    }
  };

  const downloadMedia = async () => {
    if (!moment?.media_url || downloading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setDownloading(true);
    try {
      await downloadMomentMedia(moment.media_url, isVideo);
    } finally {
      setDownloading(false);
    }
  };

  const deleteCurrentMoment = () => {
    if (!moment || !isMine || deleteMomentsMutation.isPending) return;
    Alert.alert('Delete moment?', 'This removes the moment for both of you and cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void deleteMomentsMutation.mutateAsync([moment.id]).then(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            dismissViewer();
          }).catch((error) => {
            Alert.alert('Could not delete', toUserFacingNetworkError(error, 'Please try again.').message);
          });
        },
      },
    ]);
  };

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // Swipe right anywhere to close, the same gesture (and spring) as Our moments.
  // Only claims clearly sideways drags, so taps (prev/next, hold to pause) still work.
  const dragX = useSharedValue(0);
  const swipeClose = Gesture.Pan()
    .activeOffsetX(12)
    .failOffsetX(-8)
    .failOffsetY([-16, 16])
    .onUpdate((e) => {
      dragX.value = Math.max(0, e.translationX);
    })
    .onEnd((e) => {
      if (e.translationX > DISMISS_DISTANCE || e.velocityX > DISMISS_VELOCITY) {
        dragX.value = withSpring(SCREEN_W, { ...SETTLE_SPRING, velocity: e.velocityX }, (done) => {
          if (done) runOnJS(dismissViewer)();
        });
        return;
      }
      dragX.value = withSpring(0, { ...SETTLE_SPRING, velocity: e.velocityX });
    });
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateX: dragX.value }] }));

  if (!viewer || !moment) return null;

  const showProgress = !isFocusMode && moments.length > 1;
  const headerLabel =
    isFocusMode && sectionLabel && moments.length > 1
      ? `${sectionLabel} · ${activeIndex + 1}/${moments.length}`
      : isFocusMode && sectionLabel
        ? sectionLabel
        : returnToPartnerProfile && sectionLabel
          ? sectionLabel
          : null;
  const focusLabel = headerLabel;

  const tapBottom = DOCK_APPROX + insets.bottom;

  const authorAvatar = isMine ? user?.avatar_url : (moment.author?.avatar_url ?? partner?.avatar_url);
  const backdropUri = moment.type === 'photo' ? moment.media_url : null;

  return (
    <GestureDetector gesture={swipeClose}>
      <Animated.View style={[styles.root, dragStyle]}>
        <KeyboardAvoidingView
          style={[styles.root, { backgroundColor: chrome.background }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          onLayout={onLayout}>
          <StatusBar style="light" />
          {/* The photo itself, blurred and dimmed, fills the background (Locket / Instagram style). */}
          {backdropUri ? (
            <>
              <Image source={{ uri: backdropUri }} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} />
              <View style={[StyleSheet.absoluteFill, styles.backdropDim]} />
            </>
          ) : null}

          {showProgress && (
            <View style={[styles.progressRow, { paddingTop: insets.top + 8 }]}>
              {moments.map((m, i) => (
                <View key={m.id} style={[styles.progressTrack, { backgroundColor: chrome.border }]}>
                  <View
                    style={[
                      styles.progressFill,
                      { backgroundColor: chrome.text },
                      i < activeIndex && styles.progressDone,
                      i === activeIndex && !isVideo && { width: `${progress * 100}%` },
                      i === activeIndex && isVideo && styles.progressDone,
                      i > activeIndex && { width: '0%' },
                    ]}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Who sent it and when, up top like a story. */}
          <View style={[styles.topBar, { paddingTop: showProgress ? 10 : insets.top + 10 }]}>
            <View style={[styles.authorRing, { borderColor: isMine ? '#e85d75' : '#5b8def' }]}>
              <Avatar name={authorName} imageUrl={authorAvatar} size={34} />
            </View>
            <View style={styles.authorMeta}>
              <Text style={[styles.authorName, { color: chrome.text }]} numberOfLines={1}>
                {isMine ? 'You' : authorName}
              </Text>
              <Text style={[styles.authorTime, { color: chrome.textSecondary }]} numberOfLines={1}>
                {focusLabel ? `${timeAgo} · ${focusLabel}` : timeAgo}
              </Text>
            </View>
            <Pressable
              onPress={() => void downloadMedia()}
              hitSlop={6}
              style={[styles.roundBtn, { backgroundColor: chrome.surfaceSoft }]}
              disabled={!moment.media_url || downloading}
              accessibilityLabel="Download">
              {downloading ? (
                <ActivityIndicator color={chrome.text} size="small" />
              ) : (
                <Icon name="download" size={18} color={chrome.text} />
              )}
            </Pressable>
            {isMine && (
              <Pressable
                onPress={deleteCurrentMoment}
                hitSlop={6}
                style={[styles.roundBtn, { backgroundColor: chrome.surfaceSoft }]}
                disabled={deleteMomentsMutation.isPending}
                accessibilityLabel="Delete moment">
                {deleteMomentsMutation.isPending ? (
                  <ActivityIndicator color={chrome.error} size="small" />
                ) : (
                  <Icon name="trash" size={17} color={chrome.error} />
                )}
              </Pressable>
            )}
            <Pressable
              onPress={dismissViewer}
              hitSlop={6}
              style={[styles.roundBtn, { backgroundColor: chrome.surfaceSoft }]}
              accessibilityRole="button"
              accessibilityLabel="Close">
              <Icon name="close" size={18} color={chrome.text} />
            </Pressable>
          </View>

          <Pressable style={[styles.tapLeft, { width: width * 0.28, bottom: tapBottom }]} onPress={goPrev} />
          <Pressable
            style={[styles.tapRight, { width: width * 0.72, left: width * 0.28, bottom: tapBottom }]}
            onPress={goNext}
            onLongPress={isFocusMode ? undefined : () => setPaused(true)}
            onPressOut={isFocusMode ? undefined : () => setPaused(false)}
            delayLongPress={200}
          />

          {/* The moment: a big rounded portrait card, caption on the photo. */}
          <View style={styles.stage} pointerEvents="box-none">
            <View style={[styles.card, { shadowColor: '#000' }]} pointerEvents="none">
              <MomentMedia moment={moment} advanceOnVideoEnd={!isFocusMode} onVideoEnd={goNext} />
              {moment.content?.trim() ? (
                <View style={styles.captionPill}>
                  <Text style={styles.caption} numberOfLines={3}>
                    {moment.content.trim()}
                  </Text>
                </View>
              ) : null}
              {paused && !isFocusMode ? (
                <View style={styles.pausedBadge}>
                  <Icon name="pause" size={14} color="#fff" />
                  <Text style={styles.pausedText}>Paused</Text>
                </View>
              ) : null}
            </View>
          </View>

          <MomentViewerDock
            moment={moment}
            isMine={isMine}
            authorName={authorName}
            authorAvatar={authorAvatar}
            partnerName={partnerName}
            timeAgo={timeAgo}
            userId={user?.id ?? ''}
            partnerId={partner?.id}
            reply={reply}
            onReplyChange={setReply}
            onSendReply={() => void sendReply()}
            onReact={react}
            sending={sendingReply}
            bottomInset={insets.bottom}
            floating
            dark
          />
        </KeyboardAvoidingView>
      </Animated.View>
    </GestureDetector>
  );
}

/**
 * Media at its real, unboxed aspect ratio — no crop shape, no background card.
 * The ambient blurred backdrop behind it (MomentBackdrop) supplies the atmosphere,
 * so the media itself just floats at its natural size, the way Instagram/iMessage
 * photo viewers do.
 */
function MomentMedia({
  moment,
  advanceOnVideoEnd,
  onVideoEnd,
}: {
  moment: Moment;
  advanceOnVideoEnd?: boolean;
  onVideoEnd?: () => void;
}) {
  const isVideo = moment.type === 'video' && !!moment.media_url;
  const isPhoto = moment.type === 'photo' && !!moment.media_url;

  // A generous fixed box with contentFit="contain" — no aspect ratio needs to be
  // known ahead of time, so there's no async round-trip (previously via a separate
  // Image.getSize() call) that could flash a wrong square size, or get stuck there
  // permanently if that lookup failed against a signed/CDN URL.
  if (isVideo && moment.media_url) {
    return (
      <View style={styles.mediaBox}>
        <MomentVideoPlayer
          uri={moment.media_url}
          fill
          autoPlay
          loop={!advanceOnVideoEnd}
          onEnd={advanceOnVideoEnd ? onVideoEnd : undefined}
          contentFit="cover"
          style={styles.mediaTransparentBg}
        />
      </View>
    );
  }

  if (isPhoto && moment.media_url) {
    return (
      <View style={styles.mediaBox}>
        <Image source={{ uri: moment.media_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
      </View>
    );
  }

  return (
    <View style={[styles.mediaBox, styles.mediaEmpty]}>
      <Icon name="heart" size={40} color="rgba(128,128,128,0.6)" filled />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: SCREEN_H },
  // Deep and calm behind the photo, so its colours carry the screen.
  backdropDim: { backgroundColor: 'rgba(8,8,12,0.72)' },
  card: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 34,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 22,
    elevation: 12,
  },
  mediaBox: { ...StyleSheet.absoluteFill },
  mediaTransparentBg: { backgroundColor: 'transparent' },
  mediaEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(128,128,128,0.16)' },
  captionPill: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 18,
    alignItems: 'center',
  },
  caption: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 21,
    textAlign: 'center',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  progressRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 14, zIndex: 4 },
  progressTrack: { flex: 1, height: 3, borderRadius: 1.5, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 1.5 },
  progressDone: { width: '100%' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10, zIndex: 4, gap: 8 },
  authorRing: { borderRadius: 999, borderWidth: 2, padding: 1.5 },
  authorMeta: { flex: 1, minWidth: 0, gap: 1, marginLeft: 2 },
  authorName: { fontSize: 16, fontWeight: '800' },
  authorTime: { fontSize: 12, fontWeight: '600' },
  roundBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  tapLeft: { position: 'absolute', top: 0, left: 0, zIndex: 2 },
  tapRight: { position: 'absolute', top: 0, zIndex: 2 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  pausedBadge: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pausedText: { fontSize: 13, fontWeight: '700', color: '#fff' },
});
