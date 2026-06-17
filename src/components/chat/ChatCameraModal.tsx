import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
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
import { useTheme } from '@/hooks/useTheme';

const MAX_VIDEO_SEC = 60;
const SHUTTER_HOLD_MS = 280;

interface Props {
  visible: boolean;
  onClose: () => void;
  onCapture: (uri: string, mediaType: 'image' | 'video') => void;
}

export function ChatCameraModal({ visible, onClose, onCapture }: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const cameraRef = useRef<CameraView>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didStartRecordingRef = useRef(false);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [micPermission, requestMicPermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<'front' | 'back'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [previewIsVideo, setPreviewIsVideo] = useState(false);
  const [recording, setRecording] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (visible) return;
    setPreviewUri(null);
    setPreviewIsVideo(false);
    setRecording(false);
    setSending(false);
    setCameraReady(false);
  }, [visible]);

  const close = () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (recording) cameraRef.current?.stopRecording();
    setRecording(false);
    setPreviewUri(null);
    setPreviewIsVideo(false);
    onClose();
  };

  const ensureCamera = async (): Promise<boolean> => {
    if (!cameraPermission?.granted) {
      const cam = await requestCameraPermission();
      if (!cam.granted) {
        Alert.alert('Camera access required', 'Allow camera access in Settings to take photos and videos.');
        return false;
      }
    }
    return true;
  };

  const ensureMic = async (): Promise<boolean> => {
    if (!micPermission?.granted) {
      const mic = await requestMicPermission();
      if (!mic.granted) {
        Alert.alert('Microphone needed', 'Allow microphone access to record video messages.');
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
      }
    } catch {
      Alert.alert('Could not capture', 'Please try again.');
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
      }
    } catch {
      Alert.alert('Could not record', 'Please try again.');
    } finally {
      setRecording(false);
      didStartRecordingRef.current = false;
    }
  };

  const stopRecording = () => {
    if (!recording) return;
    cameraRef.current?.stopRecording();
  };

  const resetPreview = () => {
    setPreviewUri(null);
    setPreviewIsVideo(false);
  };

  const handleSend = async () => {
    if (!previewUri) return;
    setSending(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onCapture(previewUri, previewIsVideo ? 'video' : 'image');
    close();
  };

  const onShutterPressIn = async () => {
    if (previewUri || sending) return;
    if (!(await ensureCamera())) return;

    didStartRecordingRef.current = false;
    holdTimerRef.current = setTimeout(() => {
      didStartRecordingRef.current = true;
      void startRecording();
    }, SHUTTER_HOLD_MS);
  };

  const onShutterPressOut = () => {
    if (previewUri || sending) return;

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

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={close}>
      <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.topBar}>
          <Pressable onPress={close} style={styles.topCircle} accessibilityLabel="Close camera">
            <Icon name="close" size={20} color="#fff" />
          </Pressable>
          <Text style={styles.title}>Camera</Text>
          <Pressable
            onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
            style={styles.topCircle}
            accessibilityLabel="Flip camera">
            <Icon name="flipCamera" size={20} color="#fff" />
          </Pressable>
        </View>

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
                Take photos and videos to send in chat. Camera access is required.
              </Text>
              <Pressable onPress={() => void requestCameraPermission()} style={[styles.permissionBtn, { backgroundColor: colors.accent }]}>
                <Text style={[styles.permissionBtnText, { color: colors.onAccent }]}>Allow camera</Text>
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
          <View style={styles.sideControl} />

          {previewUri ? (
            <Pressable
              onPress={() => void handleSend()}
              disabled={sending}
              style={[styles.sendBtn, { backgroundColor: colors.accent }]}>
              {sending ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <Icon name="send" size={24} color={colors.onAccent} filled />
              )}
            </Pressable>
          ) : (
            <Pressable
              onPressIn={onShutterPressIn}
              onPressOut={onShutterPressOut}
              disabled={sending || (showCamera && !cameraReady && !!cameraPermission?.granted)}
              style={[styles.shutterOuter, recording && styles.shutterRecording]}>
              <View style={[styles.shutterInner, recording && styles.shutterInnerRecording]} />
            </Pressable>
          )}

          <View style={styles.sideControl} />
        </View>

        <Text style={styles.hint}>
          {previewUri ? 'Tap send to share' : 'Tap for photo · hold for video'}
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '700' },
  viewfinder: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 16,
  },
  permissionText: { color: '#fff', textAlign: 'center', fontSize: 15, lineHeight: 22 },
  permissionBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 20 },
  permissionBtnText: { fontWeight: '700', fontSize: 15 },
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
  recordingBadge: {
    position: 'absolute',
    top: 14,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(220,38,38,0.92)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  recText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  retakeBtn: {
    position: 'absolute',
    top: 14,
    right: 14,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  retakeText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 40,
    paddingTop: 28,
  },
  sideControl: { width: 52, height: 52 },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterRecording: { borderColor: '#ef4444' },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#fff',
  },
  shutterInnerRecording: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ef4444',
  },
  sendBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hint: {
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 14,
    paddingHorizontal: 24,
  },
});
