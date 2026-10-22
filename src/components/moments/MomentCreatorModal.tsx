import AsyncStorage from '@react-native-async-storage/async-storage';
import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Haptics from '@/lib/haptics';
import { Image } from 'expo-image';
import { mediaSource } from '@/lib/storage-cdn';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInUp, FadeOut, runOnJS, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentVideoPlayer } from '@/components/moments/MomentVideoPlayer';
import { HEADER_ICON_SIZE } from '@/components/ui/HeaderIconButton';
import { Icon } from '@/components/ui/Icon';
import { Avatar, cardSurface } from '@/components/ui/primitives';
import { useCreateMoment } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { saveLocalMomentMedia } from '@/lib/download-moment-media';
import { getCurrentPlace, type PlaceSnapshot } from '@/lib/location';
import { rememberPlaceSuggestion } from '@/lib/moment-places';
import { momentChrome } from '@/lib/moment-theme';
import { toUserFacingNetworkError } from '@/lib/network-error';
import { MOMENTS_BACK, useMomentsBack } from '@/lib/moments-back';
import * as api from '@/services/api';
import { useAuthStore, useMomentStore, useRelationshipStore, useUIStore } from '@/stores';
import { todayKey } from '@/lib/play-progress';
import { usePlayProgressStore } from '@/stores/play-progress-store';
import { PermissionSheetHost } from '@/components/layout/PermissionSheetHost';
import { ensurePermission } from '@/lib/permissions';

const VIEWFINDER_RADIUS = 28;
const MAX_VIDEO_SEC = 30;
const SHUTTER_HOLD_MS = 280;
const SETTLE_SPRING = { damping: 30, stiffness: 260, mass: 0.9 };
/** Remembers the "Add location" choice between moments. Off until turned on. */
const ADD_LOCATION_PREF = 'moments:add-location';

/** "Osu, Accra, Ghana" → "Osu, Accra": short enough for the chip. */
function shortPlace(label: string) {
  return label.split(',').map((p) => p.trim()).filter(Boolean).slice(0, 2).join(', ');
}

export function MomentCreatorModal() {
  // Read live, so a fold / unfold, split screen or rotation redraws at the new size.
  const SCREEN_H = useWindowDimensions().height;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const visible = useUIStore((s) => s.showMomentCreator);
  const historyOnTop = useUIStore((s) => s.showMomentHistory);
  // Woken the moment History starts closing, so there's no frozen frame when it slides away.
  const cameraWaking = useUIStore((s) => s.momentCameraWaking);
  const setVisible = useUIStore((s) => s.setShowMomentCreator);
  const setShowMomentHistory = useUIStore((s) => s.setShowMomentHistory);
  const setMomentHistoryReturnToCamera = useUIStore((s) => s.setMomentHistoryReturnToCamera);
  const { draft, setDraft, clearDraft } = useMomentStore();
  const createMoment = useCreateMoment();
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);
  const { dailyMomentsUsed, limits } = useSubscription();
  const { requirePlus } = usePlusGate();
  const momentsRemaining = Math.max(0, limits.dailyMoments - dailyMomentsUsed);
  const atDailyLimit = Number.isFinite(limits.dailyMoments) && dailyMomentsUsed >= limits.dailyMoments;

  const cameraRef = useRef<CameraView>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didStartRecordingRef = useRef(false);
  // Guards against double-tap: `createMoment.isPending` only flips true once the mutation
  // itself starts, which is after the (often multi-second) media upload — a second tap during
  // the upload window would race past a state-based check and send the moment twice.
  const sendLockRef = useRef(false);
  // Sends run in the background now (see handleSend): the buttons never wait on one.
  const sending = false;
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewIsVideo, setPreviewIsVideo] = useState(false);
  // The picked / taken media's own shape (width ÷ height), so its frame fits it exactly.
  const [previewAspect, setPreviewAspect] = useState<number | null>(null);
  const [previewArea, setPreviewArea] = useState<{ w: number; h: number } | null>(null);
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [saving, setSaving] = useState(false);
  // "Add location" — pins this moment on Our map.
  const [addLocation, setAddLocation] = useState(false);
  const [pinnedPlace, setPinnedPlace] = useState<PlaceSnapshot | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(ADD_LOCATION_PREF)
      .then((v) => setAddLocation(v === '1'))
      .catch(() => undefined);
  }, []);

  const locate = async () => {
    setLocating(true);
    try {
      const result = await getCurrentPlace({ host: 'camera' });
      if (result.ok) {
        setPinnedPlace(result.place);
        return true;
      }
      if (result.message) Alert.alert('Location unavailable', result.message);
      return false;
    } finally {
      setLocating(false);
    }
  };

  const toggleAddLocation = async () => {
    void Haptics.selectionAsync();
    if (addLocation) {
      setAddLocation(false);
      void AsyncStorage.setItem(ADD_LOCATION_PREF, '0');
      return;
    }
    const ok = pinnedPlace ? true : await locate();
    if (!ok) return;
    setAddLocation(true);
    void AsyncStorage.setItem(ADD_LOCATION_PREF, '1');
  };

  // With the preference on, find where this shot was taken as soon as it's previewed.
  useEffect(() => {
    if (!previewUri || !addLocation || pinnedPlace || locating) return;
    void getCurrentPlace().then((result) => {
      if (result.ok) setPinnedPlace(result.place);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUri, addLocation]);

  const partnerName = getFirstName(partner?.name) ?? 'your partner';

  // Opening starts a fresh photo; closing puts the camera back to the front, flash off
  // (while rendering, once per open/close).
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (visible) {
      setDraft({ type: 'photo' });
    } else {
      setFacing('front');
      setFlash('off');
      setCameraReady(false);
    }
  }

  // Switching cameras: wait for the new one to be ready (while rendering).
  const [readyFor, setReadyFor] = useState(facing);
  if (readyFor !== facing) {
    setReadyFor(facing);
    setCameraReady(false);
  }

  const resetPreview = () => {
    setPreviewAspect(null);
    setPreviewUri(null);
    setPreviewIsVideo(false);
    setDraft({ mediaUri: null, type: 'photo' });
  };

  // "Sent to Alex" for a moment after sending (the camera stays open).
  const [sentNotice, setSentNotice] = useState(false);
  // Moments still going up in the background (shows "Sending to Alex…").
  const [backgroundSends, setBackgroundSends] = useState(0);
  useEffect(() => {
    if (!sentNotice) return;
    const t = setTimeout(() => setSentNotice(false), 2400);
    return () => clearTimeout(t);
  }, [sentNotice]);

  const close = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (recording) {
      cameraRef.current?.stopRecording();
      setRecording(false);
    }
    clearDraft();
    setPreviewUri(null);
    setPreviewIsVideo(false);
    setVisible(false);
  };

  const ensureCamera = async (): Promise<boolean> => {
    if (!cameraPermission?.granted) {
      if (!(await ensurePermission('camera', { host: 'camera' }))) return false;
      await requestCameraPermission(); // refresh the hook's status (no dialog once granted)
    }
    return true;
  };

  // First time the camera opens: ask right away (our sheet, then the system prompt),
  // instead of showing a dead "Allow camera" screen. Never re-asks once refused.
  const askedCameraRef = useRef(false);
  useEffect(() => {
    if (!visible) {
      askedCameraRef.current = false;
      return;
    }
    if (askedCameraRef.current || !cameraPermission || cameraPermission.granted || !cameraPermission.canAskAgain) return;
    askedCameraRef.current = true;
    void ensureCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, cameraPermission]);

  const ensureMic = async (): Promise<boolean> => {
    if (!micPermission?.granted) {
      if (!(await ensurePermission('microphone', { host: 'camera' }))) return false;
      await requestMicPermission();
    }
    return true;
  };

  const takePhoto = async () => {
    if (!(await ensureCamera())) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) {
        setPreviewAspect(photo.width && photo.height ? photo.width / photo.height : null);
        setPreviewUri(photo.uri);
        setPreviewIsVideo(false);
        setDraft({ type: 'photo', mediaUri: photo.uri });
      }
    } catch {
      Alert.alert('Could not capture', 'Try again or pick from your gallery.');
    }
  };

  const startRecording = async () => {
    if (!(await ensureCamera()) || !(await ensureMic())) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setRecording(true);
    try {
      const video = await cameraRef.current?.recordAsync({ maxDuration: MAX_VIDEO_SEC });
      if (video?.uri) {
        // Recorded here: the camera's own shape (the frame fills its space).
        setPreviewAspect(null);
        setPreviewUri(video.uri);
        setPreviewIsVideo(true);
        setDraft({ type: 'video', mediaUri: video.uri });
      }
    } catch {
      Alert.alert('Could not record', 'Try again or pick a video from your gallery.');
    } finally {
      setRecording(false);
      didStartRecordingRef.current = false;
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    cameraRef.current?.stopRecording();
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.85,
      videoMaxDuration: MAX_VIDEO_SEC,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const isVideo = asset.type === 'video';
    setPreviewAspect(asset.width && asset.height ? asset.width / asset.height : null);
    setPreviewUri(asset.uri);
    setPreviewIsVideo(isVideo);
    setDraft({ type: isVideo ? 'video' : 'photo', mediaUri: asset.uri });
  };

  /**
   * Send: the camera is ready for the next shot straight away ("Sending to Alex…"), and the
   * moment finishes going up in the background. If it fails, the photo comes back to try again.
   */
  const handleSend = async () => {
    if (sendLockRef.current) return;
    const type = draft.type ?? (previewIsVideo ? 'video' : 'photo');
    const mediaUri = draft.mediaUri ?? previewUri;
    if (!mediaUri || !relationship || !user) return;
    if (atDailyLimit && !requirePlus('Unlimited daily moments')) return;

    sendLockRef.current = true;
    const pin = addLocation && pinnedPlace ? pinnedPlace : null;
    const aspect = previewAspect;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    resetPreview();
    setBackgroundSends((n) => n + 1);
    sendLockRef.current = false;

    try {
      const ext = type === 'video' ? 'mp4' : 'jpg';
      const contentType = type === 'video' ? 'video/mp4' : 'image/jpeg';
      const path = `${relationship.id}/${user.id}/${Date.now()}.${ext}`;
      const mediaUrl = await api.uploadMomentMedia(path, mediaUri, contentType);

      try {
        await createMoment.mutateAsync({
          type,
          media_url: mediaUrl,
          latitude: pin?.latitude ?? null,
          longitude: pin?.longitude ?? null,
        });
      } catch (e) {
        // The file went up but the moment didn't: don't leave the file behind.
        void api.discardMomentUpload(mediaUrl);
        throw e;
      }
      if (pin) void rememberPlaceSuggestion(relationship.id, pin.latitude, pin.longitude, pin.label);
      void api.trackEvent(relationship.id, user.id, 'moment_created', { type }).catch(() => undefined);
      void usePlayProgressStore.getState().award(
        relationship.id,
        { xp: 10, stats: { moments_sent: 1 }, events: { moment_sent: 1 }, soloId: `moment-${todayKey()}` },
        'Moment sent',
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSentNotice(true);
    } catch (error) {
      // Put the photo back so it can be sent again (or saved).
      const restore = () => {
        setPreviewAspect(aspect);
        setPreviewUri(mediaUri);
        setPreviewIsVideo(type === 'video');
        setDraft({ mediaUri, type });
      };
      // Over the free plan's moments today (the server checks too): offer Plus, not an error.
      if ((error as { code?: string } | null)?.code === 'PLUS_REQUIRED') {
        restore();
        requirePlus('Unlimited daily moments');
        return;
      }
      Alert.alert(
        'Could not send moment',
        toUserFacingNetworkError(error, 'Please check your connection and try again.').message,
        [
          { text: 'Not now', style: 'cancel' },
          { text: 'Try again', onPress: restore },
        ],
      );
    } finally {
      setBackgroundSends((n) => Math.max(0, n - 1));
    }
  };

  const handleDownload = async () => {
    if (!previewUri) return;
    setSaving(true);
    try {
      await saveLocalMomentMedia(previewUri, previewIsVideo);
    } finally {
      setSaving(false);
    }
  };

  const onShutterPressIn = async () => {
    if (previewUri) return;
    if (!(await ensureCamera())) return;

    didStartRecordingRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      didStartRecordingRef.current = true;
      void startRecording();
    }, SHUTTER_HOLD_MS);
  };

  const onShutterPressOut = () => {
    if (previewUri) return;

    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }

    if (didStartRecordingRef.current || recording) {
      stopRecording();
    } else {
      void takePhoto();
    }
  };

  const flipCamera = () => {
    if (recording || !cameraPermission?.granted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFacing((current) => {
      const next = current === 'front' ? 'back' : 'front';
      if (next === 'front') setFlash('off');
      return next;
    });
  };

  useMomentsBack(MOMENTS_BACK.creator, visible, () => close());

  const inPreview = !!previewUri;
  const showCamera = !previewUri;

  // The camera stays mounted underneath History (paused), so swiping History
  // away reveals the camera itself — not Home — and it's back instantly.
  const openHistory = () => {
    setMomentHistoryReturnToCamera(true);
    setShowMomentHistory(true);
  };

  // Swipe down anywhere to close the camera, like other camera apps. Off in
  // preview (so a stray drag can't throw away a shot) and while recording.
  const translateY = useSharedValue(0);
  const swipeDown = Gesture.Pan()
    .enabled(!inPreview && !recording)
    .activeOffsetY(14)
    .failOffsetY(-10)
    .failOffsetX([-18, 18])
    .onUpdate((e) => {
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 800) {
        translateY.value = withSpring(SCREEN_H, { ...SETTLE_SPRING, velocity: e.velocityY }, (done) => {
          // Hide directly: swiping is off in preview and while recording, so
          // there's no draft or recording for close() to clean up.
          if (done) runOnJS(setVisible)(false);
        });
        return;
      }
      translateY.value = withSpring(0, { ...SETTLE_SPRING, velocity: e.velocityY });
    });
  const swipeStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  return (
    <GestureDetector gesture={swipeDown}>
      <Animated.View
        style={[
          styles.root,
          { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: chrome.background },
          swipeStyle,
        ]}>
        {inPreview ? (
          <>
            <View style={styles.previewTopBar}>
              <Pressable onPress={resetPreview} style={styles.topCircle} hitSlop={6} accessibilityRole="button" accessibilityLabel="Discard preview">
                <Icon name="close" size={HEADER_ICON_SIZE} color={chrome.text} />
              </Pressable>
              <Text style={[styles.previewTitle, { color: chrome.text }]}>{previewIsVideo ? 'Video preview' : 'Photo preview'}</Text>
              <Pressable
                onPress={() => void handleDownload()}
                disabled={saving}
                style={styles.topCircle}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Save to gallery">
                {saving ? (
                  <ActivityIndicator color={chrome.text} size="small" />
                ) : (
                  <Icon name="download" size={HEADER_ICON_SIZE} color={chrome.text} />
                )}
              </Pressable>
            </View>

            {/* The frame takes the media's own shape (no empty bars around it), as big as fits. */}
            <View
              style={styles.previewArea}
              onLayout={(e) => setPreviewArea({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
              <View
                style={[
                  styles.previewMedia,
                  { backgroundColor: chrome.mediaBackdrop },
                  fittedPreviewSize(previewAspect, previewArea),
                ]}>
                {previewIsVideo ? (
                  <MomentVideoPlayer uri={previewUri} fill autoPlay contentFit="cover" style={styles.previewVideo} />
                ) : (
                  <Image source={mediaSource(previewUri)} style={StyleSheet.absoluteFill} contentFit="cover" />
                )}
              </View>
            </View>

            <Pressable
              onPress={() => void toggleAddLocation()}
              disabled={locating}
              accessibilityRole="switch"
              accessibilityState={{ checked: addLocation }}
              accessibilityLabel="Add location to Our map"
              style={[
                styles.locationChip,
                { backgroundColor: addLocation ? chrome.accentSoft : chrome.surfaceSoft },
              ]}>
              {locating ? (
                <ActivityIndicator size="small" color={chrome.accent} />
              ) : (
                <Icon name="location" size={16} color={addLocation ? chrome.accent : chrome.textSecondary} filled={addLocation} />
              )}
              <Text
                style={[styles.locationChipText, { color: addLocation ? chrome.accent : chrome.textSecondary }]}
                numberOfLines={1}>
                {addLocation
                  ? pinnedPlace?.label
                    ? shortPlace(pinnedPlace.label)
                    : 'Location on'
                  : 'Add location'}
              </Text>
            </Pressable>

            <View style={styles.previewActions}>
              <Pressable onPress={resetPreview} style={[styles.previewSecondaryBtn, cardSurface(colors)]}>
                <Text style={[styles.previewSecondaryText, { color: chrome.text }]}>Retake</Text>
              </Pressable>

              <Pressable
                onPress={() => void handleSend()}
                disabled={sending}
                style={[styles.previewSendBtn, { backgroundColor: colors.accent }]}>
                {sending ? (
                  <ActivityIndicator color={colors.onAccent} />
                ) : (
                  <>
                    <Text style={[styles.previewSendText, { color: colors.onAccent }]}>Send moment</Text>
                    <Icon name="send" size={20} color={colors.onAccent} filled />
                  </>
                )}
              </Pressable>
            </View>

            <View style={styles.previewHintRow}>
              <Icon name="lock" size={13} color={chrome.textTertiary} />
              <Text style={[styles.previewHint, { color: chrome.textTertiary }]}>Only {partnerName} will see this</Text>
            </View>
          </>
        ) : (
          <>
            <View style={styles.topBar}>
              <Pressable onPress={close} style={styles.topCircle} hitSlop={6} accessibilityRole="button" accessibilityLabel="Close camera">
                <Icon name="close" size={HEADER_ICON_SIZE} color={chrome.text} />
              </Pressable>

              <View style={[styles.partnerPill, cardSurface(colors)]}>
                <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={22} />
                <Text style={[styles.partnerPillText, { color: chrome.text }]} numberOfLines={1}>
                  Sending to {partnerName}
                </Text>
              </View>

              <Pressable
                onPress={openHistory}
                style={styles.topCircle}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Open our moments">
                <Icon name="albums" size={HEADER_ICON_SIZE} color={chrome.text} />
              </Pressable>
            </View>

            <View style={[styles.viewfinder, { backgroundColor: chrome.surface }]}>
              {cameraPermission?.granted ? (
                <CameraView
                  key={facing}
                  ref={cameraRef}
                  style={StyleSheet.absoluteFill}
                  facing={facing}
                  flash={facing === 'back' ? flash : 'off'}
                  mirror={facing === 'front'}
                  mode="video"
                  active={!historyOnTop || cameraWaking}
                  videoQuality="720p"
                  onCameraReady={() => setCameraReady(true)}
                />
              ) : (
                <View style={styles.permissionBox}>
                  <Text style={[styles.permissionText, { color: chrome.textSecondary }]}>
                    Share photos and videos privately with {partnerName}. Camera access is required.
                  </Text>
                  <Pressable onPress={() => void ensureCamera()} style={[styles.permissionBtn, { backgroundColor: chrome.accent }]}>
                    <Text style={[styles.permissionBtnText, { color: chrome.onAccent }]}>Allow camera</Text>
                  </Pressable>
                </View>
              )}

              {showCamera && cameraPermission?.granted && (
                <>
                  {facing === 'back' && (
                    <Pressable
                      onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
                      style={styles.chipLeft}
                      accessibilityLabel={flash === 'on' ? 'Turn flash off' : 'Turn flash on'}>
                      <Icon name="flash" size={16} color={chrome.onMedia} filled={flash === 'on'} />
                    </Pressable>
                  )}

                  {!cameraReady && (
                    <View style={styles.cameraLoading}>
                      <ActivityIndicator color={chrome.onMedia} size="small" />
                    </View>
                  )}

                  {recording && (
                    <View style={styles.recordingBadge}>
                      <View style={[styles.recDot, { backgroundColor: chrome.error }]} />
                      <Text style={[styles.recText, { color: chrome.onMedia }]}>REC</Text>
                    </View>
                  )}
                </>
              )}
            </View>

            <View style={styles.footer}>
            <View style={styles.controls}>
              <Pressable
                onPress={() => void pickFromGallery()}
                style={styles.sideControl}
                accessibilityRole="button"
                accessibilityLabel="Choose from your photos">
                <Icon name="image" size={30} color={chrome.text} />
              </Pressable>

              <Pressable
                onPressIn={onShutterPressIn}
                onPressOut={onShutterPressOut}
                disabled={sending || (showCamera && !cameraReady && !!cameraPermission?.granted)}
                style={styles.shutterOuter}>
                <View
                  style={[
                    styles.shutterRing,
                    { borderColor: colors.accent },
                    recording && { borderColor: chrome.error },
                  ]}>
                  {sending ? (
                    <ActivityIndicator color={colors.onAccent} />
                  ) : (
                    <View
                      style={[
                        styles.shutterInner,
                        { backgroundColor: colors.accent },
                        recording && { width: 28, height: 28, borderRadius: 6, backgroundColor: chrome.error },
                      ]}
                    />
                  )}
                </View>
              </Pressable>

              <Pressable
                onPress={flipCamera}
                disabled={recording || !cameraReady}
                style={[styles.sideControl, (recording || !cameraReady) && styles.sideControlDisabled]}
                accessibilityLabel={`Switch to ${facing === 'front' ? 'back' : 'front'} camera`}>
                <Icon name="flipCamera" size={30} color={chrome.text} />
              </Pressable>
            </View>

            <Text style={[styles.hint, { color: chrome.textSecondary }]}>
              {recording ? 'Release to finish video' : 'Tap for photo · hold for video'}
            </Text>

            {Number.isFinite(limits.dailyMoments) && (
              <Text style={[styles.limitHint, { color: chrome.textTertiary }]}>{momentsRemaining} moments left today</Text>
            )}
            </View>
          </>
        )}
        {backgroundSends > 0 && !previewUri ? (
          <Animated.View
            entering={FadeInUp.duration(220)}
            exiting={FadeOut.duration(200)}
            pointerEvents="none"
            style={[styles.sentToast, { top: insets.top + 64 }]}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.sentToastText}>Sending to {partnerName}…</Text>
          </Animated.View>
        ) : sentNotice ? (
          <Animated.View
            entering={FadeInUp.duration(220)}
            exiting={FadeOut.duration(200)}
            pointerEvents="none"
            style={[styles.sentToast, { top: insets.top + 64 }]}>
            <Icon name="check" size={16} color="#FFFFFF" />
            <Text style={styles.sentToastText}>Sent to {partnerName}</Text>
          </Animated.View>
        ) : null}
        <PermissionSheetHost host="camera" inline />
      </Animated.View>
    </GestureDetector>
  );
}

/** The biggest box of the media's shape that fits the space (the whole space when the shape is unknown). */
function fittedPreviewSize(aspect: number | null, area: { w: number; h: number } | null) {
  if (!aspect || !area || area.w <= 0 || area.h <= 0) return null;
  return area.w / area.h > aspect
    ? { width: Math.round(area.h * aspect), height: area.h }
    : { width: area.w, height: Math.round(area.w / aspect) };
}

const styles = StyleSheet.create({
  sentToast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(20,20,20,0.82)',
  },
  sentToastText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingTop: 6, paddingBottom: 14 },
  topCircle: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  partnerPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  partnerPillText: { fontWeight: '700', fontSize: 14 },
  // Fills whatever height the top bar and footer leave, so there's no dead
  // band at the bottom on tall phones.
  viewfinder: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: VIEWFINDER_RADIUS,
    overflow: 'hidden',
  },
  // Fixed-height footer so the viewfinder doesn't jump when the free-plan
  // "moments left" line is shown or hidden.
  footer: { paddingTop: 22, paddingBottom: 12, minHeight: 168, alignItems: 'center' },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionText: { textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  permissionBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  permissionBtnText: { fontWeight: '800' },
  chipLeft: {
    position: 'absolute',
    top: 14,
    left: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraLoading: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  recordingBadge: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  recText: { fontSize: 11, fontWeight: '800' },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 44 },
  sideControl: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  sideControlDisabled: { opacity: 0.4 },
  shutterOuter: { alignItems: 'center', justifyContent: 'center' },
  shutterRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRingRec: {},
  shutterInner: { width: 62, height: 62, borderRadius: 31 },
  shutterInnerRec: {},
  hint: { textAlign: 'center', fontSize: 13, fontWeight: '600', marginTop: 14 },
  limitHint: { textAlign: 'center', fontSize: 12, fontWeight: '600', marginTop: 6 },
  // Same spacing as the camera's top bar, so nothing jumps between the two.
  previewTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 14,
  },
  previewTitle: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  // Framed like the live viewfinder, with clear space above the buttons.
  previewArea: { flex: 1, marginHorizontal: 16, marginBottom: 16, alignItems: 'center', justifyContent: 'center' },
  previewMedia: {
    width: '100%',
    height: '100%',
    borderRadius: VIEWFINDER_RADIUS,
    overflow: 'hidden',
  },
  previewVideo: { backgroundColor: 'transparent' },
  locationChip: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '80%',
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 17,
    marginBottom: 16,
  },
  locationChipText: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  previewSecondaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 999,
  },
  previewSecondaryText: { fontSize: 15, fontWeight: '700' },
  previewSendBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 999,
  },
  previewSendText: { fontSize: 16, fontWeight: '800' },
  previewHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    marginTop: 12,
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  previewHint: { fontSize: 13, fontWeight: '600' },
});
