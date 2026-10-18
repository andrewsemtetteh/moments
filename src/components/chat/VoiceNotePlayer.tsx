import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import * as Haptics from '@/lib/haptics';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  uri: string;
  isSelf: boolean;
}

const BARS = 28;
/** A note that hasn't loaded after this long shows "tap to retry" instead of spinning forever. */
const LOAD_TIMEOUT_MS = 15_000;
const SPEEDS = [1, 1.5, 2] as const;

/** Only one voice note plays at a time: starting one pauses the last. */
let nowPlaying: AudioPlayer | null = null;

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** A stable, natural-looking waveform for this note (seeded by its address). */
function waveFor(uri: string) {
  let seed = 0;
  for (let i = 0; i < uri.length; i++) seed = (seed * 31 + uri.charCodeAt(i)) >>> 0;
  return Array.from({ length: BARS }, (_, i) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = (seed % 1000) / 1000;
    const shape = Math.sin((i / (BARS - 1)) * Math.PI) * 0.45 + 0.35;
    return Math.min(1, Math.max(0.18, shape + (noise - 0.5) * 0.55));
  });
}

/**
 * A voice note in a chat bubble: play/pause, a waveform that fills as it plays
 * (tap anywhere on it to jump there), the time, and a 1× / 1.5× / 2× speed
 * toggle. Plays even with the silent switch on, and one note at a time.
 */
export function VoiceNotePlayer({ uri, isSelf }: Props) {
  const { colors } = useTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState(false);
  // Tapped play before the note had loaded: play as soon as it's ready.
  const [waiting, setWaiting] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [waveWidth, setWaveWidth] = useState(0);
  const wave = useMemo(() => waveFor(uri), [uri]);

  const ink = isSelf ? colors.chatBubbleSelfText : colors.text;
  const played = isSelf ? colors.chatBubbleSelfText : colors.accent;
  const unplayed = isSelf ? `${colors.chatBubbleSelfText}55` : `${colors.textTertiary}`;
  const duration = status.duration || 0;
  const progress = duration ? Math.min(1, status.currentTime / duration) : 0;
  const started = status.playing || status.currentTime > 0.05;

  /** Plays this note (pausing any other), from the start if it had finished. */
  const startPlayback = async () => {
    try {
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
      if (nowPlaying && nowPlaying !== player) {
        try {
          nowPlaying.pause();
        } catch {
          /* that note may already be gone */
        }
      }
      nowPlaying = player;
      if (duration && status.currentTime >= duration - 0.05) await player.seekTo(0);
      player.setPlaybackRate(SPEEDS[speedIndex]);
      player.play();
    } catch {
      setError(true);
    }
  };

  // Tapped before it loaded: play the moment it's ready.
  useEffect(() => {
    if (!waiting || !status.isLoaded || status.playing) return;
    const timer = setTimeout(() => void startPlayback(), 0);
    return () => clearTimeout(timer);
    // startPlayback reads the latest status itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, status.isLoaded]);

  // …and if it never loads (e.g. an expired link), stop spinning and offer a retry.
  useEffect(() => {
    if (!waiting || status.isLoaded) return;
    const timer = setTimeout(() => {
      setWaiting(false);
      setError(true);
    }, LOAD_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [waiting, status.isLoaded]);

  const toggle = () => {
    if (status.playing) {
      player.pause();
      setWaiting(false);
      return;
    }
    if (error) {
      // Reload it (its link may have expired) and play when it's back.
      setError(false);
      player.replace({ uri });
      setWaiting(true);
      return;
    }
    if (!status.isLoaded) {
      setWaiting(true);
      return;
    }
    void startPlayback();
  };

  const seek = async (x: number) => {
    if (!duration || !waveWidth) return;
    void Haptics.selectionAsync();
    await player.seekTo(Math.max(0, Math.min(1, x / waveWidth)) * duration);
  };

  const cycleSpeed = () => {
    void Haptics.selectionAsync();
    const next = (speedIndex + 1) % SPEEDS.length;
    setSpeedIndex(next);
    try {
      player.setPlaybackRate(SPEEDS[next]);
    } catch {
      /* not loaded yet; applied on play */
    }
  };

  // Spinner only while you're waiting on it to load; at rest it shows the play button.
  const loading = waiting && !status.isLoaded && !error;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={toggle}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'}
        style={({ pressed }) => [styles.playBtn, { backgroundColor: played }, pressed && styles.pressed]}>
        {loading ? (
          <ActivityIndicator size="small" color={isSelf ? colors.chatBubbleSelf : colors.onAccent} />
        ) : (
          <Icon
            name={status.playing ? 'pause' : 'play'}
            size={18}
            color={isSelf ? colors.chatBubbleSelf : colors.onAccent}
            filled
          />
        )}
      </Pressable>

      <View style={styles.body}>
        <Pressable
          onPress={(e) => void seek(e.nativeEvent.locationX)}
          onLayout={(e: LayoutChangeEvent) => setWaveWidth(e.nativeEvent.layout.width)}
          accessibilityLabel="Seek"
          style={styles.wave}>
          {wave.map((h, i) => (
            <View
              key={i}
              style={[
                styles.bar,
                {
                  height: `${Math.round(h * 100)}%`,
                  backgroundColor: (i + 0.5) / BARS <= progress ? played : unplayed,
                },
              ]}
            />
          ))}
        </Pressable>
        <View style={styles.meta}>
          <Text style={[styles.time, { color: ink }]}>
            {error ? 'Couldn’t load · tap to retry' : formatDuration(started ? status.currentTime : duration)}
          </Text>
          <Pressable
            onPress={cycleSpeed}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Playback speed ${SPEEDS[speedIndex]}x`}
            style={[
              styles.speed,
              { backgroundColor: isSelf ? `${colors.chatBubbleSelfText}22` : colors.surfaceElevated },
            ]}>
            <Text style={[styles.speedText, { color: ink }]}>{SPEEDS[speedIndex]}×</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 220, paddingVertical: 4, marginBottom: 2 },
  playBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.8, transform: [{ scale: 0.95 }] },
  body: { flex: 1, gap: 4 },
  wave: { height: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bar: { width: 3, borderRadius: 1.5 },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  speed: { paddingHorizontal: 7, height: 20, borderRadius: 10, justifyContent: 'center' },
  speedText: { fontSize: 11, fontWeight: '800' },
});
