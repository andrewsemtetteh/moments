import * as Haptics from '@/lib/haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated as RNAnimated, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { CALL, CallBackdrop, useCallTimer } from '@/components/call/CallParts';
import { DraggableWindow } from '@/components/call/DraggableWindow';
import { StreamView } from '@/components/call/StreamView';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { useCallStore, useRelationshipStore } from '@/stores';

type Stream = { toURL: () => string } | null;

/** The call, minimised while you use the app: a pill (voice) or a floating window (video). */
export function CallMini({ remoteStream, onEnd }: { remoteStream: Stream; onEnd: () => void }) {
  // A camera on (either of you, however the call started): the video window; else the pill.
  const video = useCallStore((s) => !s.isCameraOff || s.partnerCameraOn);
  return video ? <VideoFloat remoteStream={remoteStream} onEnd={onEnd} /> : <VoicePill onEnd={onEnd} />;
}

const expand = () => {
  void Haptics.selectionAsync();
  useCallStore.getState().setMinimized(false);
};

/** A live dot: the call is still going. */
function LiveDot() {
  const [pulse] = useState(() => new RNAnimated.Value(1));
  useEffect(() => {
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulse, { toValue: 0.35, duration: 700, useNativeDriver: true }),
        RNAnimated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return <RNAnimated.View style={[styles.liveDot, { opacity: pulse }]} />;
}

/**
 * Voice: a dark pill (like the green call pill on iPhone and WhatsApp's "Tap to return to
 * call" bar): their photo, name and timer, mute and end. Drag it up or down the screen out
 * of the way (like the video window); tap it to go back to the call.
 */
function VoicePill({ onEnd }: { onEnd: () => void }) {
  const { width } = useWindowDimensions();
  const partnerName = useCallStore((s) => s.partnerName);
  const isMuted = useCallStore((s) => s.isMuted);
  // The store's own action, held locally like `onEnd`: a gesture callback must only use values
  // from this component, not module-level functions (those weren't carried into the compiled
  // callback, and muting threw "toggleMute" errors).
  const storeToggleMute = useCallStore((s) => s.toggleMute);
  const phase = useCallStore((s) => s.phase);
  const partner = useRelationshipStore((s) => s.partner);
  const timer = useCallTimer();
  const name = getFirstName(partnerName ?? partner?.name) ?? 'Call';

  const onMute = useCallback(() => {
    void Haptics.selectionAsync();
    storeToggleMute();
  }, [storeToggleMute]);

  // Its own buttons: tapping them never opens the call. They run on the JS thread
  // (`runOnJS(true)`): they only call plain JS (the call store), nothing to animate.
  const muteTap = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd((_e, ok) => {
          if (ok) onMute();
        }),
    [onMute],
  );
  const endTap = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd((_e, ok) => {
          if (ok) onEnd();
        }),
    [onEnd],
  );
  const blockers = useMemo(() => [muteTap, endTap], [muteTap, endTap]);

  return (
    <DraggableWindow
      width={Math.min(width - 24, 420)}
      height={PILL_H}
      corner="top-right"
      minScale={1}
      maxScale={1}
      onTap={expand}
      tapBlockers={blockers}
      style={styles.pill}>
      <View accessible accessibilityRole="button" accessibilityLabel={`Return to call with ${name}`} style={styles.pillRow}>
        <Avatar name={partnerName ?? partner?.name} imageUrl={partner?.avatar_url} size={30} />
        <View style={styles.pillText}>
          <Text style={styles.pillName} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.pillMeta}>
            <LiveDot />
            <Text style={styles.pillTime}>{timer ?? (phase === 'outgoing' ? 'Ringing…' : 'Connecting…')}</Text>
          </View>
        </View>
        <GestureDetector gesture={muteTap}>
          <View accessible accessibilityRole="button" accessibilityLabel={isMuted ? 'Unmute' : 'Mute'} style={[styles.pillBtn, isMuted && styles.pillBtnOn]}>
            <Icon name={isMuted ? 'micOff' : 'mic'} size={18} color={isMuted ? '#111' : '#fff'} filled />
          </View>
        </GestureDetector>
        <GestureDetector gesture={endTap}>
          <View accessible accessibilityRole="button" accessibilityLabel="End call" style={[styles.pillBtn, styles.pillEnd]}>
            <View style={styles.hangup}>
              <Icon name="call" size={18} color="#fff" filled />
            </View>
          </View>
        </GestureDetector>
      </View>
    </DraggableWindow>
  );
}

const PILL_H = 56;

const FLOAT_W = 112;
const FLOAT_H = 164;

/**
 * Video: a floating window (FaceTime's picture in picture) with their video or photo and
 * the timer. Drag it anywhere (it settles at the nearest side), pinch with two fingers to
 * make it bigger or smaller, tap it to go back to the full call.
 */
function VideoFloat({ remoteStream, onEnd }: { remoteStream: Stream; onEnd: () => void }) {
  const { colors } = useTheme();
  const partner = useRelationshipStore((s) => s.partner);
  const timer = useCallTimer();
  // The end button's own tap (made once), so pressing it doesn't also open the call. On the JS
  // thread, like the pill's buttons (see VoicePill).
  const endTap = useMemo(
    () =>
      Gesture.Tap()
        .runOnJS(true)
        .onEnd((_e, ok) => {
          if (ok) onEnd();
        }),
    [onEnd],
  );
  const blockers = useMemo(() => [endTap], [endTap]);

  return (
    <DraggableWindow
      width={FLOAT_W}
      height={FLOAT_H}
      // The whole screen, top to bottom, like the voice pill.
      snapToSide
      maxScale={2.2}
      onTap={expand}
      tapBlockers={blockers}
      style={styles.float}>
      {remoteStream ? (
        <StreamView stream={remoteStream} />
      ) : (
        <>
          <CallBackdrop photo={partner?.avatar_url} tint={colors.accent} />
          <View style={styles.floatAvatar}>
            <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={52} />
          </View>
        </>
      )}
      <View style={styles.floatTimer} pointerEvents="none">
        <LiveDot />
        <Text style={styles.floatTimerText}>{timer ?? '…'}</Text>
      </View>
      <GestureDetector gesture={endTap}>
        <View accessible accessibilityRole="button" accessibilityLabel="End call" style={styles.floatEnd}>
          <View style={styles.hangup}>
            <Icon name="call" size={14} color="#fff" filled />
          </View>
        </View>
      </GestureDetector>
    </DraggableWindow>
  );
}

const styles = StyleSheet.create({
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: CALL.green },
  pill: {
    borderRadius: 28,
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: 'rgba(16,16,20,0.94)',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
  },
  pillRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 10, paddingRight: 8 },
  pillText: { flex: 1, minWidth: 0 },
  pillName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  pillMeta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pillTime: { color: CALL.soft, fontSize: 12.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pillBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillBtnOn: { backgroundColor: '#fff' },
  pillEnd: { backgroundColor: CALL.red },
  hangup: { transform: [{ rotate: '135deg' }] },
  float: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: CALL.bg,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    zIndex: 1000,
    elevation: 1000,
  },
  floatAvatar: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  floatTimer: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  floatTimerText: { color: '#fff', fontSize: 11.5, fontWeight: '800', fontVariant: ['tabular-nums'] },
  floatEnd: {
    position: 'absolute',
    right: 8,
    top: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: CALL.red,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
