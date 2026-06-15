import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  uri: string;
  isSelf: boolean;
}

function formatDuration(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceNotePlayer({ uri, isSelf }: Props) {
  const { colors } = useTheme();
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const [error, setError] = useState(false);

  const accent = isSelf ? colors.chatBubbleSelfText : colors.accent;
  const track = isSelf ? `${colors.chatBubbleSelfText}55` : colors.border;
  const progress = useMemo(() => {
    if (!status.duration) return 0;
    return Math.min(1, status.currentTime / status.duration);
  }, [status.currentTime, status.duration]);

  useEffect(() => {
    if (status.isLoaded) setError(false);
  }, [status.isLoaded]);

  const toggle = async () => {
    try {
      if (status.playing) {
        player.pause();
        return;
      }
      if (status.currentTime >= (status.duration || 0) - 0.05 && status.duration) {
        await player.seekTo(0);
      }
      player.play();
    } catch {
      setError(true);
    }
  };

  return (
    <Pressable
      onPress={toggle}
      style={[styles.row, { backgroundColor: isSelf ? `${colors.chatBubbleSelfText}18` : colors.surface, borderColor: track }]}
      accessibilityRole="button"
      accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'}>
      <View style={[styles.playBtn, { backgroundColor: accent }]}>
        {status.isBuffering && !status.isLoaded ? (
          <ActivityIndicator size="small" color={isSelf ? colors.chatBubbleSelf : colors.onAccent} />
        ) : (
          <Icon name={status.playing ? 'pause' : 'play'} size={16} color={isSelf ? colors.chatBubbleSelf : colors.onAccent} filled />
        )}
      </View>
      <View style={styles.body}>
        <View style={[styles.track, { backgroundColor: track }]}>
          <View style={[styles.fill, { backgroundColor: accent, width: `${progress * 100}%` }]} />
        </View>
        <Text style={[styles.time, { color: accent }]}>
          {error ? 'Unavailable' : formatDuration(status.playing ? status.currentTime : status.duration || 0)}
        </Text>
      </View>
      <Icon name="mic" size={16} color={accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 180,
    marginBottom: 4,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 2 },
  time: { fontSize: 11, fontWeight: '600' },
});
