import { CameraView, useCameraPermissions, useMicrophonePermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MomentVideoPlayer } from '@/components/moments/MomentVideoPlayer';
import { HEADER_ICON_SIZE } from '@/components/ui/HeaderIconButton';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { saveLocalMomentMedia } from '@/lib/download-moment-media';

const MAX_VIDEO_SEC = 60;
const SHUTTER_HOLD_MS = 280;
const SCREEN_H = Dimensions.get('window').height;

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
  const [saving, setSaving] = useState(false);
  const dragY = useSharedValue(0);
  const dragStyle = useAnimatedStyle(() => ({ transform: [{ translateY: dragY.value }] }));

  useEffect(() => {
    if (visible) return;
    // A swipe-close leaves the page off-screen; start the next open in place.
    dragY.value = 0;
    setPreviewUri(null);
    setPreviewIsVideo(false);
    setRecording(false);
    setSending(false);
    setCameraReady(false);
  }, [visible, dragY]);

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

  const savePreview = async () => {
    if (!previewUri || saving) return;
    setSaving(true);
    try {
      const saved = await saveLocalMomentMedia(previewUri, previewIsVideo);
      if (saved) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } finally {
      setSaving(false);
    }
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

  // Swipe down to close, like the moments camera. Off in preview (a stray drag
  // shouldn't throw away the shot) and while recording.
  const swipeDown = Gesture.Pan()
    .enabled(!previewUri && !recording)
    .activeOffsetY(14)
    .failOffsetY(-10)
    .failOffsetX([-18, 18])
    .onUpdate((e) => {
      dragY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (e.translationY > 120 || e.velocityY > 800) {
        dragY.value = withTiming(SCREEN_H, { duration: 180 }, (done) => {
          if (done) runOnJS(onClose)();
        });
        return;
      }
      dragY.value = withSpring(0, { damping: 30, stiffness: 260, velocity: e.velocityY });
    });
  return (
    // No system slide: opens and closes instantly, like the moments camera
    // (the only motion is your own swipe down). Transparent (over full screen)
    // so a swipe reveals the chat underneath, never a blank white window.
    <Modal
      visible
      transparent
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={close}>
      <GestureHandlerRootView style={styles.flex}>
        <GestureDetector gesture={swipeDown}>
          <Animated.View
            style={[
              styles.root,
              { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom },
              dragStyle,
            ]}>
            <View style={styles.topBar}>
              {previewUri ? (
                <Pressable
                  onPress={resetPreview}
                  disabled={sending}
                  hitSlop={6}
                  style={styles.topIcon}
                  accessibilityRole="button"
                  accessibilityLabel="Discard and go back to camera">
                  <Icon name="close" size={HEADER_ICON_SIZE} color={colors.text} />
                </Pressable>
              ) : (
                <Pressable onPress={close} hitSlop={6} style={styles.topIcon} accessibilityRole="button" accessibilityLabel="Close camera">
                  <Icon name="close" size={HEADER_ICON_SIZE} color={colors.text} />
                </Pressable>
              )}
              <Text style={[styles.title, { color: colors.text }]}>{previewUri ? 'Preview' : 'Camera'}</Text>
              {previewUri ? (
                <Pressable
                  onPress={() => void savePreview()}
                  disabled={saving || sending}
                  hitSlop={6}
                  style={styles.topIcon}
                  accessibilityRole="button"
                  accessibilityLabel="Save to your photos">
                  {saving ? (
                    <ActivityIndicator color={colors.text} />
                  ) : (
                    <Icon name="download" size={HEADER_ICON_SIZE} color={colors.text} />
                  )}
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
                  hitSlop={6}
                  style={styles.topIcon}
                  accessibilityRole="button"
                  accessibilityLabel="Flip camera">
                  <Icon name="flipCamera" size={HEADER_ICON_SIZE} color={colors.text} />
                </Pressable>
              )}
            </View>

            <View style={[styles.viewfinder, { backgroundColor: colors.surface }]}>
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
                  videoQuality="720p"
                  onCameraReady={() => setCameraReady(true)}
                />
              ) : (
                <View style={styles.permissionBox}>
                  <Text style={[styles.permissionText, { color: colors.text }]}>
                    Take photos and videos to send in chat. Camera access is required.
                  </Text>
                  <Pressable
                    onPress={() => void requestCameraPermission()}
                    style={[styles.permissionBtn, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.permissionBtnText, { color: colors.onAccent }]}>Allow camera</Text>
                  </Pressable>
                </View>
              )}

              {showCamera && cameraPermission?.granted && (
                <>
                  <Pressable
                    onPress={() => setFlash((f) => (f === 'off' ? 'on' : 'off'))}
                    style={styles.chipLeft}
                    accessibilityLabel={flash === 'on' ? 'Turn flash off' : 'Turn flash on'}>
                    <Icon name="flash" size={18} color="#fff" filled={flash === 'on'} />
                  </Pressable>
                  {recording && (
                    <View style={styles.recordingBadge}>
                      <View style={styles.recDot} />
                      <Text style={styles.recText}>REC</Text>
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Fixed-height footer so the viewfinder keeps its size between camera and preview. */}
            <View style={previewUri ? styles.previewFooter : styles.footer}>
              {previewUri ? (
                <View style={styles.previewActions}>
                  <Pressable
                    onPress={resetPreview}
                    disabled={sending}
                    accessibilityRole="button"
                    style={({ pressed }) => [styles.retakeBtn, { backgroundColor: colors.surface }, pressed && styles.pressed]}>
                    <Text style={[styles.retakeText, { color: colors.text }]}>Retake</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handleSend()}
                    disabled={sending}
                    accessibilityRole="button"
                    accessibilityLabel={previewIsVideo ? 'Send video' : 'Send photo'}
                    style={({ pressed }) => [
                      styles.sendBtn,
                      { backgroundColor: colors.accent },
                      pressed && styles.pressed,
                    ]}>
                    {sending ? (
                      <ActivityIndicator color={colors.onAccent} />
                    ) : (
                      <>
                        <Text style={[styles.sendText, { color: colors.onAccent }]}>Send</Text>
                        <Icon name="send" size={20} color={colors.onAccent} filled />
                      </>
                    )}
                  </Pressable>
                </View>
              ) : (
                <>
                  <View style={styles.controls}>
                    <Pressable
                      onPressIn={onShutterPressIn}
                      onPressOut={onShutterPressOut}
                      disabled={sending || (showCamera && !cameraReady && !!cameraPermission?.granted)}
                      accessibilityRole="button"
                      accessibilityLabel="Take photo, hold for video"
                      style={[styles.shutterOuter, { borderColor: recording ? '#ef4444' : colors.accent }]}>
                      <View
                        style={[
                          styles.shutterInner,
                          { backgroundColor: colors.accent },
                          recording && styles.shutterInnerRecording,
                        ]}
                      />
                    </Pressable>
                  </View>
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>
                    {recording ? 'Release to finish video' : 'Tap for photo · hold for video'}
                  </Text>
                </>
              )}
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 14,
  },
  topIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  viewfinder: {
    flex: 1,
    marginHorizontal: 16,
    borderRadius: 28,
    overflow: 'hidden',
  },
  permissionBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    gap: 16,
  },
  permissionText: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
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
  footer: { minHeight: 150, justifyContent: 'center', paddingTop: 18, paddingBottom: 8 },
  // Preview: an even 20pt above the buttons and below them (plus the home bar).
  previewFooter: { paddingTop: 20, paddingBottom: 12 },
  previewActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  retakeBtn: {
    height: 56,
    paddingHorizontal: 24,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeText: { fontWeight: '700', fontSize: 16 },
  pressed: { opacity: 0.85 },
  controls: { alignItems: 'center' },
  sideControl: { width: 52, height: 52 },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
  },
  shutterInnerRecording: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ef4444',
  },
  // Big and filled with the theme's accent, so it reads as THE action on every theme.
  sendBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 17, fontWeight: '800' },
  hint: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 14,
    paddingHorizontal: 24,
  },
});
