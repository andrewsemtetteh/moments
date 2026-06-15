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
import * as api from '@/services/api';
import { useAuthStore, useMomentStore, useRelationshipStore, useUIStore } from '@/stores';

const VIEWFINDER_RADIUS = 28;
const MAX_VIDEO_SEC = 30;
const SHUTTER_HOLD_MS = 280;

export function MomentCreatorModal() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
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

  const partnerName = partner?.name?.split(' ')[0] ?? 'your partner';

  useEffect(() => {
    if (!visible) return;
    setDraft({ type: 'photo' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const ext = type === 'video' ? 'mp4' : 'jpg';
    const contentType = type === 'video' ? 'video/mp4' : 'image/jpeg';
    const path = `${relationship.id}/${user.id}/${Date.now()}.${ext}`;
    const mediaUrl = await api.uploadMedia('moments', path, mediaUri, contentType);

    await createMoment.mutateAsync({ type, media_url: mediaUrl });
    await api.trackEvent(relationship.id, user.id, 'moment_created', { type });
    close();
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
    if (previewUri) {
      void handleSend();
      return;
    }

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

  if (!visible) return null;

  const showCamera = !previewUri;
  const sending = createMoment.isPending;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.topBar}>
          <Pressable onPress={close} style={styles.topCircle}>
            <Icon name="close" size={20} color="#fff" />
          </Pressable>

          <View style={styles.partnerPill}>
            <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={22} />
            <Text style={styles.partnerPillText} numberOfLines={1}>
              {relationship?.relationship_name ?? 'Moments'}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              close();
              router.push('/(tabs)/chat');
            }}
            style={styles.topCircle}>
            <Icon name="messages" size={20} color="#fff" />
          </Pressable>
        </View>

        <Text style={styles.subtitle}>Send a moment to {partnerName}</Text>

        <View style={styles.viewfinder}>
          {previewUri ? (
            previewIsVideo ? (
              <MomentVideoPlayer uri={previewUri} fill autoPlay />
            ) : (
              <Image source={{ uri: previewUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            )
          ) : cameraPermission?.granted ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing={facing}
              flash={flash}
              mode="video"
              onCameraReady={() => setCameraReady(true)}
            />
          ) : (
            <View style={styles.permissionBox}>
              <Text style={styles.permissionText}>
                Share photos and videos privately with {partnerName}. Camera access is required.
              </Text>
              <Pressable onPress={() => void requestCameraPermission()} style={styles.permissionBtn}>
                <Text style={styles.permissionBtnText}>Allow camera</Text>
              </Pressable>
            </View>
          )}

          {showCamera && cameraPermission?.granted && (
            <>
              <Pressable onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))} style={styles.chipLeft}>
                <Icon name="flash" size={16} color="#fff" filled={flash === 'on'} />
              </Pressable>
              {recording && (
                <View style={styles.recordingBadge}>
                  <View style={styles.recDot} />
                  <Text style={styles.recText}>REC</Text>
                </View>
              )}
            </>
          )}

          {previewUri && (
            <Pressable onPress={resetPreview} style={styles.retakeBtn}>
              <Text style={styles.retakeText}>Retake</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.controls}>
          <Pressable onPress={() => void pickFromGallery()} style={styles.sideControl}>
            <Icon name="image" size={26} color="#fff" />
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
                previewUri && { backgroundColor: colors.accentSoft },
                recording && styles.shutterRingRec,
              ]}>
              {sending ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <View
                  style={[
                    styles.shutterInner,
                    { backgroundColor: colors.accent },
                    previewUri && styles.shutterInnerSend,
                    recording && styles.shutterInnerRec,
                  ]}
                />
              )}
            </View>
          </Pressable>

          <Pressable onPress={() => setFacing((f) => (f === 'front' ? 'back' : 'front'))} style={styles.sideControl}>
            <Icon name="flipCamera" size={26} color="#fff" />
          </Pressable>
        </View>

        <Text style={styles.hint}>
          {previewUri
            ? 'Release to send to your partner'
            : recording
              ? 'Release to finish video'
              : 'Tap for photo · hold for video'}
        </Text>

        <Pressable
          onPress={() => setShowMomentHistory(true)}
          style={styles.historyPill}>
          <Icon name="image" size={14} color="#fff" />
          <Text style={styles.historyText}>Moment history</Text>
          <Icon name="chevronDown" size={14} color="rgba(255,255,255,0.6)" />
        </Pressable>

        {Number.isFinite(limits.dailyMoments) && (
          <Text style={styles.limitHint}>{momentsRemaining} moments left today</Text>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8 },
  topCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1C1C1E', alignItems: 'center', justifyContent: 'center' },
  partnerPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 12,
    backgroundColor: '#1C1C1E',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    justifyContent: 'center',
  },
  partnerPillText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  subtitle: { color: 'rgba(255,255,255,0.55)', textAlign: 'center', fontSize: 13, fontWeight: '600', marginBottom: 12 },
  viewfinder: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: VIEWFINDER_RADIUS,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
    maxHeight: 480,
  },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionText: { color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  permissionBtn: { backgroundColor: '#fff', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 999 },
  permissionBtnText: { fontWeight: '800', color: '#111' },
  chipLeft: { position: 'absolute', top: 14, left: 14, padding: 8 },
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
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3040' },
  recText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  retakeBtn: { position: 'absolute', bottom: 14, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 },
  retakeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36, paddingVertical: 8 },
  sideControl: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  shutterOuter: { alignItems: 'center', justifyContent: 'center' },
  shutterRing: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRingRec: { borderColor: '#FF3040' },
  shutterInner: { width: 62, height: 62, borderRadius: 31 },
  shutterInnerSend: { width: 54, height: 54, borderRadius: 27 },
  shutterInnerRec: { width: 28, height: 28, borderRadius: 6, backgroundColor: '#FF3040' },
  hint: { color: 'rgba(255,255,255,0.45)', textAlign: 'center', fontSize: 12, fontWeight: '600', marginTop: 4 },
  historyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    backgroundColor: '#1C1C1E',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    marginTop: 12,
  },
  historyText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  limitHint: { textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 8 },
});
