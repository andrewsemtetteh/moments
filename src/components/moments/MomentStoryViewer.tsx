import { useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    View,
    type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentBlobFrame } from '@/components/moments/MomentBlobFrame';
import { MomentVideoPlayer } from '@/components/moments/MomentVideoPlayer';
import { MomentViewerDock } from '@/components/moments/MomentViewerDock';
import { Icon } from '@/components/ui/Icon';
import { useDeleteMoments, useMomentReaction, useSendMessage } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { downloadMomentMedia } from '@/lib/download-moment-media';
import { fitMediaDimensions, getRemoteImageAspect } from '@/lib/media-aspect';
import { toggleMomentReactionForUser } from '@/lib/moment-display';
import { momentToReplyContext } from '@/lib/moment-reply';
import { momentChrome } from '@/lib/moment-theme';
import { toUserFacingNetworkError } from '@/lib/network-error';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import type { Moment } from '@/types/database';

const STORY_DURATION_MS = 8000;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const BLOB_W = Math.min(SCREEN_W - 40, 360);
const DOCK_APPROX = 300;

function viewerSessionKey(
  viewer: NonNullable<ReturnType<typeof useUIStore.getState>['momentViewer']>,
) {
  return `${viewer.playback}:${viewer.startIndex}:${viewer.moments.map((m) => m.id).join('|')}`;
}

export function MomentStoryViewer() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
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
  const [nativeView, setNativeView] = useState(false);
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
    setNativeView(false);
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
      router.push('/(tabs)/chat');
    } catch {
      setChatDraft(text);
      setChatMomentReply(momentToReplyContext(moment));
      dismissViewer();
      router.push('/(tabs)/chat');
    } finally {
      setSendingReply(false);
    }
  };

  const toggleNativeView = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNativeView((v) => !v);
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

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={dismissViewer}>
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: chrome.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        onLayout={onLayout}>
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

        <View style={[styles.topBar, { paddingTop: showProgress ? 8 : insets.top + 12 }]}>
          <Pressable onPress={dismissViewer} hitSlop={12} style={styles.topIcon}>
            <Icon name="close" size={28} color={chrome.text} />
          </Pressable>
          <View style={styles.topCenter}>
            {focusLabel ? <Text style={[styles.focusLabel, { color: chrome.textSecondary }]}>{focusLabel}</Text> : null}
          </View>
          <View style={styles.topRight}>
            <Pressable
              onPress={toggleNativeView}
              hitSlop={10}
              style={[styles.topIcon, nativeView && { backgroundColor: chrome.accent }]}
              accessibilityLabel={nativeView ? 'Story frame' : 'Original size'}>
              <Icon name="expand" size={22} color={nativeView ? chrome.onAccent : chrome.text} />
            </Pressable>
            <Pressable
              onPress={() => void downloadMedia()}
              hitSlop={10}
              style={styles.topIcon}
              disabled={!moment.media_url || downloading}
              accessibilityLabel="Download">
              {downloading ? (
                <ActivityIndicator color={chrome.text} size="small" />
              ) : (
                <Icon name="download" size={22} color={chrome.text} />
              )}
            </Pressable>
            {isMine && (
              <Pressable
                onPress={deleteCurrentMoment}
                hitSlop={10}
                style={styles.topIcon}
                disabled={deleteMomentsMutation.isPending}
                accessibilityLabel="Delete moment">
                {deleteMomentsMutation.isPending ? (
                  <ActivityIndicator color={chrome.error} size="small" />
                ) : (
                  <Icon name="trash" size={21} color={chrome.error} />
                )}
              </Pressable>
            )}
          </View>
        </View>

        <Pressable style={[styles.tapLeft, { width: width * 0.28, bottom: tapBottom }]} onPress={goPrev} />
        <Pressable
          style={[styles.tapRight, { width: width * 0.72, left: width * 0.28, bottom: tapBottom }]}
          onPress={goNext}
          onLongPress={isFocusMode ? undefined : () => setPaused(true)}
          onPressOut={isFocusMode ? undefined : () => setPaused(false)}
          delayLongPress={200}
        />

        <View style={styles.stage}>
          <MomentMedia
            moment={moment}
            nativeView={nativeView}
            advanceOnVideoEnd={!isFocusMode}
            onVideoEnd={goNext}
            chrome={chrome}
          />
        </View>

        {paused && !isFocusMode && (
          <View style={styles.pausedBadge}>
            <Icon name="pause" size={14} color={chrome.onMedia} />
            <Text style={[styles.pausedText, { color: chrome.onMedia }]}>Paused</Text>
          </View>
        )}

        <MomentViewerDock
          moment={moment}
          isMine={isMine}
          authorName={authorName}
          authorAvatar={isMine ? user?.avatar_url : (moment.author?.avatar_url ?? partner?.avatar_url)}
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
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

function MomentMedia({
  moment,
  nativeView,
  advanceOnVideoEnd,
  onVideoEnd,
  chrome,
}: {
  moment: Moment;
  nativeView: boolean;
  advanceOnVideoEnd?: boolean;
  onVideoEnd?: () => void;
  chrome: ReturnType<typeof momentChrome>;
}) {
  const [aspect, setAspect] = useState(1);
  const isVideo = moment.type === 'video' && !!moment.media_url;
  const isPhoto = moment.type === 'photo' && !!moment.media_url;

  useEffect(() => {
    if (!nativeView || !moment.media_url) return;
    if (isVideo) {
      setAspect(9 / 16);
      return;
    }
    void getRemoteImageAspect(moment.media_url).then(setAspect);
  }, [nativeView, moment.media_url, isVideo]);

  if (!nativeView) {
    if (isVideo) {
      return (
        <View style={{ width: BLOB_W, height: BLOB_W * 1.12, borderRadius: 24, overflow: 'hidden' }}>
          <MomentVideoPlayer
            uri={moment.media_url!}
            fill
            autoPlay
            loop={!advanceOnVideoEnd}
            onEnd={advanceOnVideoEnd ? onVideoEnd : undefined}
          />
        </View>
      );
    }
    if (isPhoto) {
      return <MomentBlobFrame width={BLOB_W} imageUri={moment.media_url} />;
    }
    return (
      <MomentBlobFrame width={BLOB_W} fill={chrome.surface}>
        <Icon name="heart" size={40} color={chrome.textTertiary} filled />
      </MomentBlobFrame>
    );
  }

  const size = fitMediaDimensions(aspect);
  const radius = Math.abs(aspect - 1) < 0.08 ? 20 : 16;

  if (isVideo && moment.media_url) {
    return (
      <View style={[size, { borderRadius: radius, overflow: 'hidden', backgroundColor: chrome.mediaBackdrop }]}>
        <MomentVideoPlayer
          uri={moment.media_url}
          fill
          autoPlay
          loop={!advanceOnVideoEnd}
          onEnd={advanceOnVideoEnd ? onVideoEnd : undefined}
        />
      </View>
    );
  }

  if (isPhoto && moment.media_url) {
    return (
      <View style={[size, { borderRadius: radius, overflow: 'hidden', backgroundColor: chrome.mediaBackdrop }]}>
        <Image source={{ uri: moment.media_url }} style={StyleSheet.absoluteFill} contentFit="contain" />
      </View>
    );
  }

  return (
    <View
      style={[
        size,
        {
          borderRadius: radius,
          backgroundColor: chrome.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}>
      <Icon name="heart" size={40} color={chrome.textTertiary} filled />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: SCREEN_H },
  progressRow: { flexDirection: 'row', gap: 4, paddingHorizontal: 14, zIndex: 4 },
  progressTrack: { flex: 1, height: 2, borderRadius: 1, overflow: 'hidden' },
  progressFill: { height: '100%' },
  progressDone: { width: '100%' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 4,
    gap: 8,
  },
  topCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
  topIcon: {
    padding: 6,
    borderRadius: 20,
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topRight: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 84, justifyContent: 'flex-end' },
  focusLabel: { fontSize: 14, fontWeight: '700', textAlign: 'center' },
  tapLeft: { position: 'absolute', top: 0, left: 0, zIndex: 2 },
  tapRight: { position: 'absolute', top: 0, zIndex: 2 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, zIndex: 1 },
  pausedBadge: {
    position: 'absolute',
    top: '40%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.65)',
    zIndex: 5,
  },
  pausedText: { fontSize: 13, fontWeight: '700' },
});
