import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';

import { CallMini } from '@/components/call/CallMini';
import { DraggableWindow } from '@/components/call/DraggableWindow';
import { CALL, CallBackdrop, CallButton, CallChip, PulseRings, useCallTimer } from '@/components/call/CallParts';
import { StreamView } from '@/components/call/StreamView';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { callManager } from '@/lib/call-manager';
import { loadExpoNotifications } from '@/lib/expo-notifications-safe';
import { getWebRTCModule, isWebRTCAvailable } from '@/lib/webrtc-native';
import { useAuthStore, useCallStore, useRelationshipStore } from '@/stores';

type Stream = { toURL: () => string } | null;

/**
 * The call, in three sizes:
 * - full screen (this): incoming, ringing and in call, for voice and video;
 * - minimised while you use the app (CallMini): a pill at the top for voice, a floating
 *   window for video; tap either to come back;
 * - out of the app: an "Ongoing call" notification to tap back in (and, on iPhone, the
 *   call keeps going in the background).
 */
export function CallOverlay() {
  const phase = useCallStore((s) => s.phase);
  const minimized = useCallStore((s) => s.minimized);
  const callId = useCallStore((s) => s.callId);
  const reset = useCallStore((s) => s.reset);
  const signedIn = useAuthStore((s) => !!s.user);
  const [localStream, setLocalStream] = useState<Stream>(null);
  const [remoteStream, setRemoteStream] = useState<Stream>(null);

  useEffect(() => {
    callManager.setStreamCallbacks({ onLocalStream: setLocalStream, onRemoteStream: setRemoteStream });
    return () => callManager.setStreamCallbacks({});
  }, []);

  useOngoingCallNotification();

  // Settings › Developer call previews use a "preview-…" id: no real call behind them.
  const isPreview = !!callId?.startsWith('preview-');
  // …but your camera is real (on a development build), so the preview looks like a call.
  const previewCamera = usePreviewCamera(isPreview);
  const endCall = async () => {
    try {
      if (!isPreview) await callManager.endCall();
    } finally {
      reset();
    }
  };

  // Only for a signed-in account (never over the sign-in screens).
  if (phase === 'idle' || !signedIn) return null;
  // An incoming call always shows in full: it needs an answer.
  if (minimized && phase !== 'incoming') {
    return <CallMini remoteStream={remoteStream} onEnd={() => void endCall()} />;
  }
  const mine = isPreview ? previewCamera : localStream;
  return <CallScreen localStream={mine} remoteStream={remoteStream} isPreview={isPreview} onEnd={endCall} />;
}

function CallScreen({
  localStream,
  remoteStream,
  isPreview,
  onEnd,
}: {
  localStream: Stream;
  remoteStream: Stream;
  isPreview: boolean;
  onEnd: () => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const { colors } = useTheme();
  const phase = useCallStore((s) => s.phase);
  const mode = useCallStore((s) => s.mode);
  const partnerName = useCallStore((s) => s.partnerName);
  const callId = useCallStore((s) => s.callId);
  const isMuted = useCallStore((s) => s.isMuted);
  const isCameraOff = useCallStore((s) => s.isCameraOff);
  const partnerCameraOn = useCallStore((s) => s.partnerCameraOn);
  const isSpeaker = useCallStore((s) => s.isSpeaker);
  const error = useCallStore((s) => s.error);
  const store = useCallStore;
  const partner = useRelationshipStore((s) => s.partner);
  const me = useAuthStore((s) => s.user);
  const timer = useCallTimer();

  const name = getFirstName(partnerName ?? partner?.name) ?? 'Your person';
  const ringing = phase === 'incoming' || phase === 'outgoing' || phase === 'connecting';
  // Each camera is its own (Instagram / Snapchat): yours, and theirs.
  const myCamera = !isCameraOff;
  const theirCamera = partnerCameraOn;
  // Instagram's layout: with no camera on, the voice screen. Once either camera is on, a
  // video layout: one of you fills the screen and the other is the small window (their
  // video if they're on camera, otherwise you); tap the small one to swap.
  const videoLayout = phase !== 'incoming' && (myCamera || theirCamera);
  const [swapped, setSwapped] = useState(false);
  const themBigByDefault = theirCamera && phase === 'active';
  const themBig = swapped ? !themBigByDefault : themBigByDefault;
  // Their real video (in a preview there's none: their photo stands in, as when it's off).
  const theirVideo = theirCamera && !!remoteStream && phase === 'active' ? remoteStream : null;
  const myVideo = myCamera && localStream ? localStream : null;
  // "Ama turned on their camera": an easy way to turn yours on too (never automatic).
  const [inviteDismissed, setInviteDismissed] = useState(false);
  const showCameraInvite = phase === 'active' && theirCamera && !myCamera && !inviteDismissed;

  const status = useMemo(() => {
    if (error) return error;
    if (phase === 'incoming') return mode === 'video' ? 'Moments video call' : 'Moments voice call';
    if (phase === 'outgoing') return 'Ringing…';
    if (phase === 'connecting') return 'Connecting…';
    return timer ?? '';
  }, [error, phase, mode, timer]);

  const accept = async () => {
    if (!callId) return;
    if (isPreview) {
      // As a real call: "Connecting…" for a moment, then connected.
      store.getState().setPhase('connecting');
      setTimeout(() => {
        if (store.getState().phase === 'connecting') store.getState().setPhase('active');
      }, 1200);
      return;
    }
    try {
      store.getState().setPhase('connecting');
      await callManager.acceptCall(callId, mode);
    } catch (e) {
      Alert.alert('Call failed', e instanceof Error ? e.message : 'Please try again');
      store.getState().reset();
    }
  };

  const decline = async () => {
    try {
      if (callId && !isPreview) await callManager.rejectCall(callId);
    } finally {
      store.getState().reset();
    }
  };

  const swap = useCallback(() => setSwapped((v) => !v), []);

  const setMyCamera = (on: boolean) => {
    store
      .getState()
      .setMyCamera(on)
      .catch((e: unknown) => Alert.alert('Couldn’t switch the camera', e instanceof Error ? e.message : 'Please try again.'));
  };

  // The screen slides itself up on open and all the way down on close, over the app (no
  // black gap behind it), following your finger when you swipe it down.
  const offY = screenH + 40;
  const y = useSharedValue(offY);
  useEffect(() => {
    y.set(withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) }));
    // Slides in once, when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const minimiseNow = () => store.getState().setMinimized(true);
  const minimise = () => {
    y.set(withTiming(offY, { duration: 240, easing: Easing.in(Easing.cubic) }, (done) => {
      if (done) runOnJS(minimiseNow)();
    }));
  };

  // Swipe down anywhere to minimise (not while it's ringing in: that needs an answer).
  // Made once (per phase), not every second with the timer, so a drag is never cut off.
  const swipeDown = useMemo(
    () =>
      Gesture.Pan()
        .enabled(phase !== 'incoming')
        .activeOffsetY(14)
        .failOffsetX([-24, 24])
        .onUpdate((e) => {
          y.set(Math.max(0, e.translationY));
        })
        .onEnd((e) => {
          if (e.translationY > 140 || e.velocityY > 900) {
            y.set(
              withTiming(offY, { duration: 220, easing: Easing.out(Easing.cubic) }, (done) => {
                if (done) runOnJS(minimiseNow)();
              }),
            );
          } else {
            y.set(withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) }));
          }
        }),
    // y is a shared value (stable); minimiseNow only reads the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [phase, offY],
  );
  const selfBlocks = useMemo(() => [swipeDown], [swipeDown]);
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    borderTopLeftRadius: y.value > 2 ? 28 : 0,
    borderTopRightRadius: y.value > 2 ? 28 : 0,
  }));

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={minimise}>
      <StatusBar style="light" />
      {/* Gestures inside a Modal need their own root (Android). */}
      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={swipeDown}>
          <Animated.View style={[styles.root, styles.sheet, { backgroundColor: CALL.bg }, sheetStyle]}>
            {/* Full screen: whoever's big in the video layout, or the voice backdrop. */}
            {videoLayout ? (
              themBig ? (
                <PersonView video={theirVideo} name={partnerName ?? partner?.name} photo={partner?.avatar_url} tint={colors.accent} big cameraOff={phase === 'active' && !theirCamera} />
              ) : (
                <PersonView video={myVideo} mirror name={me?.name} photo={me?.avatar_url} tint={colors.accent} big cameraOff={!myCamera} />
              )
            ) : (
              <CallBackdrop photo={partner?.avatar_url} tint={colors.accent} />
            )}
            {/* A little darker so the name and buttons read over any video. */}
            {videoLayout ? <View style={styles.videoScrim} pointerEvents="none" /> : null}

            {/* Top: minimise (left), flip your camera (right, while it's on). */}
            <View style={[styles.topRow, { top: insets.top + 8 }]}>
              {phase === 'incoming' ? (
                <View style={styles.chipSpace} />
              ) : (
                <CallChip icon="chevronDown" label="Minimise call" onPress={minimise} />
              )}
              {myCamera && phase !== 'incoming' ? (
                <CallChip icon="flipCamera" label="Flip camera" onPress={() => store.getState().flipCamera()} />
              ) : (
                <View style={styles.chipSpace} />
              )}
            </View>

            {/* Who and how long: big in the middle, small at the top in the video layout. */}
            {videoLayout ? (
              <View style={[styles.compactHeader, { top: insets.top + 12 }]} pointerEvents="none">
                <Text style={styles.compactName} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.status}>{status}</Text>
              </View>
            ) : (
              <View style={[styles.center, { paddingTop: insets.top + 40 }]} pointerEvents="none">
                <View style={styles.avatarWrap}>
                  <PulseRings size={136} active={ringing} />
                  <View style={styles.avatarRing}>
                    <Avatar name={partnerName ?? partner?.name} imageUrl={partner?.avatar_url} size={128} />
                  </View>
                </View>
                <Text style={styles.name} numberOfLines={1} adjustsFontSizeToFit>
                  {name}
                </Text>
                <Text style={[styles.status, phase === 'active' && styles.timer]}>{status}</Text>
              </View>
            )}

            {/* The small window: the other one of you. Drag it anywhere, pinch to resize, tap to swap. */}
            {videoLayout ? (
              <DraggableWindow
                width={104}
                height={150}
                corner="top-right"
                topClear={52}
                bottomClear={150}
                maxScale={2.4}
                blocks={selfBlocks}
                onTap={swap}
                style={styles.selfView}>
                {themBig ? (
                  <PersonView video={myVideo} mirror name={me?.name} photo={me?.avatar_url} tint={colors.accent} cameraOff={!myCamera} />
                ) : (
                  <PersonView video={theirVideo} name={partnerName ?? partner?.name} photo={partner?.avatar_url} tint={colors.accent} cameraOff={phase === 'active' && !theirCamera} />
                )}
              </DraggableWindow>
            ) : null}

            {/* They turned their camera on: yours stays off until you choose. */}
            {showCameraInvite ? (
              <View style={[styles.invite, { bottom: insets.bottom + 140 }]}>
                <Text style={styles.inviteText} numberOfLines={1}>
                  {name} turned on their camera
                </Text>
                <Pressable onPress={() => setMyCamera(true)} accessibilityRole="button" style={styles.inviteBtn}>
                  <Icon name="videocam" size={15} color="#111" filled />
                  <Text style={styles.inviteBtnText}>Turn on yours</Text>
                </Pressable>
                <Pressable onPress={() => setInviteDismissed(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Not now">
                  <Icon name="close" size={18} color={CALL.soft} />
                </Pressable>
              </View>
            ) : null}

            {/* Bottom: answer, or the in-call controls on a frosted panel. */}
            {phase === 'incoming' ? (
              <View style={[styles.answerRow, { paddingBottom: insets.bottom + 36 }]}>
                <CallButton icon="call" rotate="135deg" label="Decline" danger size={74} onPress={() => void decline()} />
                <CallButton icon={mode === 'video' ? 'videocam' : 'call'} label="Accept" accept size={74} onPress={() => void accept()} />
              </View>
            ) : (
              <View style={[styles.panel, { marginBottom: insets.bottom + 16 }]}>
                <CallButton icon={isMuted ? 'micOff' : 'mic'} label={isMuted ? 'Unmute' : 'Mute'} on={isMuted} onPress={() => store.getState().toggleMute()} />
                {/* Your camera, any time: on a voice call it turns video on (for you only). */}
                <CallButton
                  icon={myCamera ? 'videocam' : 'videocamOff'}
                  label={myCamera ? 'Camera' : 'Camera off'}
                  on={myCamera}
                  onPress={() => setMyCamera(!myCamera)}
                />
                <CallButton icon="volumeHigh" label="Speaker" on={isSpeaker} onPress={() => store.getState().toggleSpeaker()} />
                <CallButton icon="call" rotate="135deg" label="End" danger onPress={() => void onEnd()} />
              </View>
            )}

            {!isWebRTCAvailable() && !isPreview && phase !== 'incoming' ? (
              <View style={[styles.banner, { bottom: insets.bottom + 140 }]}>
                <Text style={styles.bannerText}>Calls need a development build. They don’t work in Expo Go.</Text>
              </View>
            ) : null}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

/**
 * One of you in the video layout: their (or your) video, or, with the camera off, the
 * photo on a blurred backdrop with "Camera off" (as Instagram shows someone off camera).
 */
function PersonView({
  video,
  mirror = false,
  name,
  photo,
  tint,
  big = false,
  cameraOff,
}: {
  video: Stream;
  mirror?: boolean;
  name?: string | null;
  photo?: string | null;
  tint: string;
  big?: boolean;
  cameraOff: boolean;
}) {
  if (video) return <StreamView stream={video} mirror={mirror} />;
  return (
    <View style={StyleSheet.absoluteFill}>
      <CallBackdrop photo={photo} tint={tint} />
      <View style={styles.personCenter}>
        <Avatar name={name} imageUrl={photo} size={big ? 112 : 48} />
        {cameraOff ? <Text style={[styles.selfOffText, big && styles.cameraOffBig]}>Camera off</Text> : null}
      </View>
    </View>
  );
}

/**
 * Developer previews: your real camera while it's on in the preview (no call, nothing sent),
 * stopped as soon as it's off or the preview ends. Nothing on Expo Go (no WebRTC there).
 */
function usePreviewCamera(isPreview: boolean): Stream {
  const phase = useCallStore((s) => s.phase);
  const cameraOn = useCallStore((s) => !s.isCameraOff);
  const [stream, setStream] = useState<(Stream & { getTracks: () => { stop: () => void }[] }) | null>(null);
  const want = isPreview && cameraOn && phase !== 'idle' && phase !== 'incoming';

  useEffect(() => {
    const webrtc = getWebRTCModule();
    if (!want || !webrtc) return;
    let live: { getTracks: () => { stop: () => void }[] } | null = null;
    let cancelled = false;
    void (webrtc.mediaDevices.getUserMedia({ video: true, audio: false }) as unknown as Promise<
      { toURL: () => string; getTracks: () => { stop: () => void }[] }
    >)
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        live = s;
        setStream(s);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      live?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [want]);

  return want ? stream : null;
}

/**
 * Leaving the app mid-call: an "Ongoing call" notification to tap back in (kept on
 * Android until the call ends), cleared as soon as you're back or the call ends.
 */
function useOngoingCallNotification() {
  const phase = useCallStore((s) => s.phase);
  const partnerName = useCallStore((s) => s.partnerName);
  const mode = useCallStore((s) => s.mode);
  const shown = useRef<string | null>(null);

  useEffect(() => {
    const Notifications = loadExpoNotifications();
    if (!Notifications) return;
    const clear = () => {
      if (shown.current) void Notifications.dismissNotificationAsync(shown.current).catch(() => undefined);
      shown.current = null;
    };
    if (phase !== 'active' && phase !== 'connecting') {
      clear();
      return;
    }
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        clear();
        return;
      }
      if (state !== 'background' || shown.current) return;
      const name = getFirstName(partnerName) ?? 'your person';
      void Notifications.scheduleNotificationAsync({
        content: {
          title: `${mode === 'video' ? 'Video' : 'Voice'} call with ${name}`,
          body: 'Ongoing call · Tap to go back',
          data: { type: 'call_ongoing' },
          sticky: true,
          autoDismiss: false,
        },
        trigger: null,
      })
        .then((id) => {
          shown.current = id;
        })
        .catch(() => undefined);
    });
    return () => {
      sub.remove();
      clear();
    };
  }, [phase, partnerName, mode]);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  sheet: { overflow: 'hidden' },
  cameraNote: { color: CALL.soft, fontSize: 13, fontWeight: '600', marginTop: 6 },
  invite: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 12,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(18,18,24,0.82)',
  },
  inviteText: { flex: 1, color: '#fff', fontSize: 14, fontWeight: '700' },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 34, paddingHorizontal: 12, borderRadius: 17, backgroundColor: '#fff' },
  inviteBtnText: { color: '#111', fontSize: 13, fontWeight: '800' },
  videoScrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.12)' },
  topRow: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', zIndex: 5 },
  chipSpace: { width: 44, height: 44 },
  center: { flex: 1, alignItems: 'center', paddingHorizontal: 32, gap: 6 },
  avatarWrap: { width: 136, height: 136, alignItems: 'center', justifyContent: 'center', marginTop: 40, marginBottom: 18 },
  avatarRing: { borderRadius: 999, borderWidth: 4, borderColor: 'rgba(255,255,255,0.9)' },
  name: { color: CALL.text, fontSize: 34, fontWeight: '800', letterSpacing: -0.8 },
  status: { color: CALL.soft, fontSize: 16, fontWeight: '600' },
  timer: { fontVariant: ['tabular-nums'], color: CALL.text },
  compactHeader: { position: 'absolute', left: 72, right: 72, alignItems: 'center' },
  compactName: { color: CALL.text, fontSize: 20, fontWeight: '800' },
  selfView: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#24232B',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  selfOff: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  personCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  cameraOffBig: { fontSize: 15, marginTop: 6 },
  selfOffText: { color: CALL.soft, fontSize: 11, fontWeight: '700' },
  answerRow: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-evenly' },
  panel: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 32,
    backgroundColor: CALL.panel,
  },
  banner: { position: 'absolute', left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 12, padding: 12 },
  bannerText: { color: '#fff', textAlign: 'center', fontSize: 13, lineHeight: 18 },
});
