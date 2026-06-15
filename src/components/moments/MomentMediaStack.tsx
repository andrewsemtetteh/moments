import { StyleSheet, View, type ViewStyle } from 'react-native';

import { MomentBlobFrame } from '@/components/moments/MomentBlobFrame';
import { MomentVideoPlayer } from '@/components/moments/MomentVideoPlayer';
import { Icon } from '@/components/ui/Icon';
import type { Moment } from '@/types/database';

const BLOB_ASPECT = 1.12;
const MAX_LAYERS = 3;

/** Back-to-front offsets — edges peek from behind the front blob */
const LAYER_STYLES: ViewStyle[] = [
  { transform: [{ translateX: -34 }, { translateY: -30 }, { rotate: '-9deg' }, { scale: 0.8 }] },
  { transform: [{ translateX: 30 }, { translateY: -24 }, { rotate: '8deg' }, { scale: 0.87 }] },
  { transform: [{ translateX: 0 }, { translateY: 0 }, { rotate: '0deg' }, { scale: 1 }] },
];

interface MomentMediaStackProps {
  moments: Moment[];
  width: number;
}

export function MomentMediaStack({ moments, width }: MomentMediaStackProps) {
  const layers = moments.slice(0, MAX_LAYERS);
  const ordered = [...layers].reverse();
  const height = width * BLOB_ASPECT;
  const stackDepth = ordered.length;
  const topInset = stackDepth > 1 ? 36 : 0;

  return (
    <View style={[styles.stack, { width, height: height + topInset }]}>
      {ordered.map((moment, layerIdx) => {
        const isFront = layerIdx === ordered.length - 1;
        const styleIdx = styleIndexForLayer(layerIdx, ordered.length);
        return (
          <View
            key={moment.id}
            style={[
              styles.layer,
              { width, height, top: topInset },
              LAYER_STYLES[styleIdx],
              { zIndex: layerIdx + 1 },
              !isFront && styles.layerBack,
            ]}>
            <MomentStackTile moment={moment} width={width} isFront={isFront} />
          </View>
        );
      })}
    </View>
  );
}

function styleIndexForLayer(layerIdx: number, total: number) {
  if (total === 1) return 2;
  if (total === 2) return layerIdx === 0 ? 0 : 2;
  return layerIdx;
}

function MomentStackTile({
  moment,
  width,
  isFront,
}: {
  moment: Moment;
  width: number;
  isFront: boolean;
}) {
  const isVideo = moment.type === 'video' && !!moment.media_url;

  if (isVideo) {
    return (
      <View style={{ width, height: width * BLOB_ASPECT, borderRadius: 24, overflow: 'hidden' }}>
        <MomentVideoPlayer uri={moment.media_url!} fill autoPlay={isFront} />
      </View>
    );
  }

  if (moment.type === 'photo' && moment.media_url) {
    return <MomentBlobFrame width={width} imageUri={moment.media_url} />;
  }

  return (
    <MomentBlobFrame width={width} fill="#2a2a35">
      <Icon name="heart" size={36} color="rgba(255,255,255,0.5)" filled />
    </MomentBlobFrame>
  );
}

const styles = StyleSheet.create({
  stack: {
    position: 'relative',
    alignSelf: 'center',
  },
  layer: {
    position: 'absolute',
    left: 0,
    alignItems: 'center',
  },
  layerBack: {
    opacity: 0.9,
  },
});
