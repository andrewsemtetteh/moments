import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView, type VideoContentFit } from 'expo-video';

interface MomentVideoPlayerProps {
  uri: string;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  fill?: boolean;
  loop?: boolean;
  /** How the video fits its box — 'cover' crops to fill, 'contain' shows the full frame. */
  contentFit?: VideoContentFit;
  /** Native play/seek/volume controls. Defaults to on only when not autoplaying. */
  controls?: boolean;
  onEnd?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function MomentVideoPlayer({
  uri,
  width,
  height,
  autoPlay = true,
  fill,
  loop = true,
  contentFit = 'cover',
  controls,
  onEnd,
  style,
}: MomentVideoPlayerProps) {
  const player = useVideoPlayer(uri, (playerInstance) => {
    playerInstance.loop = loop;
    playerInstance.muted = autoPlay;
    if (autoPlay) playerInstance.play();
  });

  useEffect(() => {
    if (!onEnd) return;
    const subscription = player.addListener('playToEnd', onEnd);
    return () => subscription.remove();
  }, [player, onEnd]);

  const sizeStyle = fill
    ? StyleSheet.absoluteFill
    : { width: width ?? ('100%' as const), height: height ?? 200 };

  return (
    <View style={[sizeStyle, { overflow: 'hidden', backgroundColor: '#000' }, style]}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit={contentFit}
        nativeControls={controls ?? !autoPlay}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  video: { flex: 1 },
});
