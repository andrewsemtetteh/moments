import { Image } from 'expo-image';
import { StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useVideoTileSource } from '@/hooks/useVideoThumbnail';
import { thumbUrl } from '@/lib/storage-cdn';
import type { Moment } from '@/types/database';

/**
 * A moment as a small picture: a photo's small copy, or a video's still (saved with it,
 * or a frame read from the video for older ones) with a small play mark. Never the video
 * file itself in an Image, which shows nothing.
 */
export function MomentThumbImage({
  moment,
  style,
  playMark = true,
}: {
  moment: Moment;
  style: StyleProp<ImageStyle>;
  /** A small ▶ on videos (off for tiny rings). */
  playMark?: boolean;
}) {
  const isVideo = moment.type === 'video';
  const video = useVideoTileSource(isVideo ? moment.media_url : null);
  const source = isVideo ? video.source : moment.media_url ? { uri: thumbUrl(moment.media_url) } : null;

  return (
    <View style={[styles.wrap, style as never]}>
      {source ? (
        <Image
          source={source}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          onError={isVideo ? video.onError : undefined}
        />
      ) : null}
      {isVideo && playMark ? (
        <View style={styles.play} pointerEvents="none">
          <Icon name="play" size={12} color="#FFFFFF" filled />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden', backgroundColor: '#1F1D24', alignItems: 'center', justifyContent: 'center' },
  play: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
