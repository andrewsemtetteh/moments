import { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StreamView } from '@/components/call/StreamView';
import { Avatar } from '@/components/ui/primitives';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { callManager } from '@/lib/call-manager';
import { isWebRTCAvailable } from '@/lib/webrtc-native';
import { useCallStore } from '@/stores';

export function CallOverlay() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const phase = useCallStore((s) => s.phase);
  const mode = useCallStore((s) => s.mode);
  const partnerName = useCallStore((s) => s.partnerName);
  const callId = useCallStore((s) => s.callId);
  const isMuted = useCallStore((s) => s.isMuted);
  const isCameraOff = useCallStore((s) => s.isCameraOff);
  const isSpeaker = useCallStore((s) => s.isSpeaker);
  const error = useCallStore((s) => s.error);
  const setPhase = useCallStore((s) => s.setPhase);
  const setError = useCallStore((s) => s.setError);
  const toggleMute = useCallStore((s) => s.toggleMute);
  const toggleCamera = useCallStore((s) => s.toggleCamera);
  const toggleSpeaker = useCallStore((s) => s.toggleSpeaker);
  const reset = useCallStore((s) => s.reset);

  const [localStream, setLocalStream] = useState<{ toURL: () => string } | null>(null);
  const [remoteStream, setRemoteStream] = useState<{ toURL: () => string } | null>(null);

  const visible = phase !== 'idle';

  useEffect(() => {
    callManager.setStreamCallbacks({
      onLocalStream: setLocalStream,
      onRemoteStream: setRemoteStream,
    });
    return () => callManager.setStreamCallbacks({});
  }, []);

  const statusLabel = useMemo(() => {
    if (error) return error;
    if (phase === 'incoming') return `${mode === 'video' ? 'Video' : 'Voice'} call`;
    if (phase === 'outgoing') return 'Calling…';
    if (phase === 'connecting') return 'Connecting…';
    if (phase === 'active') return 'Connected';
    return '';
  }, [error, mode, phase]);

  const endAndReset = async () => {
    await callManager.endCall();
    reset();
  };

  const accept = async () => {
    if (!callId) return;
    try {
      setPhase('connecting');
      await callManager.acceptCall(callId, mode);
    } catch (e) {
      Alert.alert('Call failed', e instanceof Error ? e.message : 'Please try again');
      reset();
    }
  };

  const reject = async () => {
    if (callId) await callManager.rejectCall(callId);
    reset();
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="fullScreen" onRequestClose={endAndReset}>
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {mode === 'video' && remoteStream ? (
          <StreamView stream={remoteStream} />
        ) : (
          <View style={[styles.audioBackdrop, { backgroundColor: colors.gradient[0] }]}>
            <Avatar name={partnerName} size={120} />
          </View>
        )}

        {mode === 'video' && localStream && !isCameraOff && (
          <View style={[styles.localPreview, { top: insets.top + 16 }]}>
            <StreamView stream={localStream} mirror />
          </View>
        )}

        <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
          <Text style={[styles.name, { color: '#fff' }]}>{partnerName ?? 'Partner'}</Text>
          <Text style={styles.status}>{statusLabel}</Text>
        </View>

        {phase === 'incoming' ? (
          <View style={[styles.incomingActions, { paddingBottom: insets.bottom + 24 }]}>
            <Pressable onPress={reject} style={[styles.roundBtn, { backgroundColor: colors.error }]}>
              <Icon name="close" size={28} color="#fff" />
              <Text style={styles.roundLabel}>Decline</Text>
            </Pressable>
            <Pressable onPress={accept} style={[styles.roundBtn, { backgroundColor: colors.success }]}>
              <Icon name={mode === 'video' ? 'videocam' : 'call'} size={28} color="#fff" filled />
              <Text style={styles.roundLabel}>Accept</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.controls, { paddingBottom: insets.bottom + 24 }]}>
            <Pressable onPress={toggleMute} style={[styles.controlBtn, { backgroundColor: isMuted ? colors.error : 'rgba(255,255,255,0.18)' }]}>
              <Icon name={isMuted ? 'micOff' : 'mic'} size={24} color="#fff" filled={isMuted} />
            </Pressable>
            {mode === 'video' && (
              <Pressable onPress={toggleCamera} style={[styles.controlBtn, { backgroundColor: isCameraOff ? colors.error : 'rgba(255,255,255,0.18)' }]}>
                <Icon name={isCameraOff ? 'videocamOff' : 'videocam'} size={24} color="#fff" filled={isCameraOff} />
              </Pressable>
            )}
            <Pressable onPress={toggleSpeaker} style={[styles.controlBtn, { backgroundColor: isSpeaker ? colors.accent : 'rgba(255,255,255,0.18)' }]}>
              <Icon name="volumeHigh" size={24} color="#fff" filled={isSpeaker} />
            </Pressable>
            <Pressable onPress={endAndReset} style={[styles.hangup, { backgroundColor: colors.error }]}>
              <Icon name="call" size={28} color="#fff" filled />
            </Pressable>
          </View>
        )}

        {!isWebRTCAvailable() && phase !== 'incoming' && (
          <View style={styles.banner}>
            <Text style={styles.bannerText}>Calls need a dev build — WebRTC isn&apos;t available in Expo Go.</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  audioBackdrop: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  localPreview: {
    position: 'absolute',
    right: 16,
    width: 108,
    height: 152,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  topBar: { position: 'absolute', left: 0, right: 0, alignItems: 'center', paddingHorizontal: 24 },
  name: { fontSize: 24, fontWeight: '800' },
  status: { color: 'rgba(255,255,255,0.82)', fontSize: 14, marginTop: 4 },
  controls: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hangup: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '135deg' }],
  },
  incomingActions: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  roundBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  roundLabel: { color: '#fff', fontSize: 12, fontWeight: '700' },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 120,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 12,
    padding: 12,
  },
  bannerText: { color: '#fff', textAlign: 'center', fontSize: 13, lineHeight: 18 },
});
