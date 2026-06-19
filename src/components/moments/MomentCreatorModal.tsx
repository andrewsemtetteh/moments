import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentVideoPlayer } from '@/components/moments/MomentVideoPlayer';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useCreateMoment } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { saveLocalMomentMedia } from '@/lib/download-moment-media';
import { momentChrome } from '@/lib/moment-theme';
import { toUserFacingNetworkError } from '@/lib/network-error';
import * as api from '@/services/api';
import { useAuthStore, useMomentStore, useRelationshipStore, useUIStore } from '@/stores';

const VIEWFINDER_RADIUS = 28;
const MAX_VIDEO_SEC = 30;
const SHUTTER_HOLD_MS = 280;

export function MomentCreatorModal() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const chrome = momentChrome(colors);
  const router = useRouter();
  const visible = useUIStore((s) => s.showMomentCreator);
  const setVisible = useUIStore((s) => s.setShowMomentCreator);
  const setShowMomentHistory = useUIStore((s) => s.setShowMomentHistory);
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
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('front');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewIsVideo, setPreviewIsVideo] = useState(false);
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [saving, setSaving] = useState(false);

  const partnerName = partner?.name?.split(' ')[0] ?? 'your partner';

  useEffect(() => {
    if (!visible) return;
    setDraft({ type: 'photo' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (visible) return;
    setFacing('front');
    setFlash('off');
    setCameraReady(false);
  }, [visible]);

  useEffect(() => {
    setCameraReady(false);
  }, [facing]);

  const resetPreview = () => {
    setPreviewUri(null);
    setPreviewIsVideo(false);
    setDraft({ mediaUri: null, type: 'photo' });
  };

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
      const cam = await requestCameraPermission();
      if (!cam.granted) return false;
    }
    return true;
  };

  const ensureMic = async (): Promise<boolean> => {
    if (!micPermission?.granted) {
      const mic = await requestMicPermission();
      if (!mic.granted) {
        Alert.alert('Microphone needed', 'Allow microphone access to record video moments for your partner.');
        return false;
      }
    }
    return true;
  };

  const takePhoto = async () => {
    if (!(await ensureCamera())) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.85 });
      if (photo?.uri) {
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
    setPreviewUri(asset.uri);
    setPreviewIsVideo(isVideo);
    setDraft({ type: isVideo ? 'video' : 'photo', mediaUri: asset.uri });
  };

  const handleSend = async () => {
    const type = draft.type ?? (previewIsVideo ? 'video' : 'photo');
    const mediaUri = draft.mediaUri ?? previewUri;
    if (!mediaUri || !relationship || !user) return;
    if (atDailyLimit && !requirePlus('Unlimited daily moments')) return;

    try {
      const ext = type === 'video' ? 'mp4' : 'jpg';
      const contentType = type === 'video' ? 'video/mp4' : 'image/jpeg';
      const path = `${relationship.id}/${user.id}/${Date.now()}.${ext}`;
      const mediaUrl = await api.uploadMomentMedia(path, mediaUri, contentType);

      await createMoment.mutateAsync({ type, media_url: mediaUrl });
      await api.trackEvent(relationship.id, user.id, 'moment_created', { type });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      close();
    } catch (error) {
      Alert.alert(
        'Could not send moment',
        toUserFacingNetworkError(error, 'Please check your connection and try again.').message,
      );
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

  if (!visible) return null;

  const inPreview = !!previewUri;
  const showCamera = !previewUri;
  const sending = createMoment.isPending;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: chrome.background }]}>
        {inPreview ? (
          <>
            <View style={styles.previewTopBar}>
              <Pressable onPress={resetPreview} style={[styles.topCircle, { backgroundColor: chrome.surface }]} accessibilityLabel="Discard preview">
                <Icon name="close" size={22} color={chrome.text} />
              </Pressable>
              <Text style={[styles.previewTitle, { color: chrome.text }]}>{previewIsVideo ? 'Video preview' : 'Photo preview'}</Text>
              <Pressable
                onPress={() => void handleDownload()}
                disabled={saving}
                style={[styles.topCircle, { backgroundColor: chrome.surface }]}
                accessibilityLabel="Save to gallery">
                {saving ? (
                  <ActivityIndicator color={chrome.text} size="small" />
                ) : (
                  <Icon name="download" size={22} color={chrome.text} />
                )}
              </Pressable>
            </View>

            <View style={[styles.previewMedia, { backgroundColor: chrome.mediaBackdrop }]}>
              {previewIsVideo ? (
                <MomentVideoPlayer uri={previewUri} fill autoPlay />
              ) : (
                <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              )}
            </View>

            <View style={styles.previewActions}>
              <Pressable onPress={resetPreview} style={[styles.previewSecondaryBtn, { backgroundColor: chrome.surfaceSoft }]}>
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
                    <Icon name="send" size={20} color={colors.onAccent} filled />
                    <Text style={[styles.previewSendText, { color: colors.onAccent }]}>Send moment</Text>
                  </>
                )}
              </Pressable>
            </View>

            <Text style={[styles.previewHint, { color: chrome.textTertiary }]}>Only {partnerName} will see this</Text>
          </>
        ) : (
          <>
            <View style={styles.topBar}>
              <Pressable onPress={close} style={[styles.topCircle, { backgroundColor: chrome.surface }]}>
                <Icon name="close" size={20} color={chrome.text} />
              </Pressable>

              <View style={[styles.partnerPill, { backgroundColor: chrome.surface }]}>
                <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={22} />
                <Text style={[styles.partnerPillText, { color: chrome.text }]} numberOfLines={1}>
                  {relationship?.relationship_name ?? 'Moments'}
                </Text>
              </View>

              <Pressable
                onPress={() => {
                  close();
                  router.push('/(tabs)/chat');
                }}
                style={[styles.topCircle, { backgroundColor: chrome.surface }]}>
                <Icon name="messages" size={20} color={chrome.text} />
              </Pressable>
            </View>

            <Text style={[styles.subtitle, { color: chrome.textSecondary }]}>Send a moment to {partnerName}</Text>

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
                  onCameraReady={() => setCameraReady(true)}
                />
              ) : (
                <View style={styles.permissionBox}>
                  <Text style={[styles.permissionText, { color: chrome.textSecondary }]}>
                    Share photos and videos privately with {partnerName}. Camera access is required.
                  </Text>
                  <Pressable onPress={() => void requestCameraPermission()} style={[styles.permissionBtn, { backgroundColor: chrome.accent }]}>
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

            <View style={styles.controls}>
              <Pressable onPress={() => void pickFromGallery()} style={styles.sideControl}>
                <Icon name="image" size={26} color={chrome.text} />
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
                style={[styles.sideControl, styles.flipControl, { backgroundColor: chrome.surfaceSoft }, (recording || !cameraReady) && styles.sideControlDisabled]}
                accessibilityLabel={`Switch to ${facing === 'front' ? 'back' : 'front'} camera`}>
                <Icon name="flipCamera" size={24} color={chrome.text} />
              </Pressable>
            </View>

            <Text style={[styles.hint, { color: chrome.textTertiary }]}>
              {recording ? 'Release to finish video' : 'Tap for photo · hold for video'}
            </Text>

            <Pressable onPress={() => setShowMomentHistory(true)} style={[styles.historyPill, { backgroundColor: chrome.surface }]}>
              <Icon name="image" size={14} color={chrome.text} />
              <Text style={[styles.historyText, { color: chrome.text }]}>Moment history</Text>
              <Icon name="chevronDown" size={14} color={chrome.textSecondary} />
            </Pressable>

            {Number.isFinite(limits.dailyMoments) && (
              <Text style={[styles.limitHint, { color: chrome.textTertiary }]}>{momentsRemaining} moments left today</Text>
            )}
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  topCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
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
  subtitle: { textAlign: 'center', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  viewfinder: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: VIEWFINDER_RADIUS,
    overflow: 'hidden',
    maxHeight: 480,
  },
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
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36, paddingVertical: 8 },
  sideControl: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  flipControl: {
    borderRadius: 24,
  },
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
  hint: { textAlign: 'center', fontSize: 12, fontWeight: '600', marginTop: 4 },
  historyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: 12,
  },
  historyText: { fontWeight: '700', fontSize: 14 },
  limitHint: { textAlign: 'center', fontSize: 11, marginTop: 8 },
  previewTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  previewTitle: { fontSize: 16, fontWeight: '700' },
  previewMedia: {
    flex: 1,
    marginHorizontal: 12,
    marginBottom: 16,
    borderRadius: VIEWFINDER_RADIUS,
    overflow: 'hidden',
  },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 8,
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
  previewHint: {
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    paddingHorizontal: 20,
  },
});
