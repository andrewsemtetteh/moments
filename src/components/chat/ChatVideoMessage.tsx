import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { MomentVideoPlayer } from '@/components/moments/MomentVideoPlayer';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

interface Props {
  uri: string;
  isSelf: boolean;
}

export function ChatVideoMessage({ uri, isSelf }: Props) {
  const { colors } = useTheme();
  const [playing, setPlaying] = useState(false);
  const accent = isSelf ? colors.chatBubbleSelfText : colors.accent;

  if (playing) {
    return (
      <View style={styles.wrap}>
        <MomentVideoPlayer uri={uri} width={220} height={220} autoPlay={false} />
      </View>
    );
  }

  return (
    <Pressable
      onPress={() => setPlaying(true)}
      style={styles.wrap}
      accessibilityLabel="Play video"
      accessibilityRole="button">
      <View style={styles.poster} />
      <View style={styles.overlay}>
        <View style={[styles.playBtn, { backgroundColor: `${accent}E6` }]}>
          <Icon name="play" size={28} color="#fff" filled />
        </View>
        <View style={styles.badge}>
          <Icon name="videocam" size={12} color="#fff" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 220,
    height: 220,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 6,
    backgroundColor: '#101010',
  },
  poster: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#1a1a1a',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.22)',
  },
  playBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  badge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
