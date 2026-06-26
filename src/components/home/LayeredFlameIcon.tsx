import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';

const OUTER = '#FF6B00';
const MID = '#FF9500';
const INNER = '#FFD600';

type LayeredFlameIconProps = {
  size: number;
};

/** Layered flame icons sharing a baseline — reads as one streak flame. */
export function LayeredFlameIcon({ size }: LayeredFlameIconProps) {
  const width = Math.round(size * 0.74);
  const mid = Math.round(size * 0.8);
  const inner = Math.round(size * 0.52);

  return (
    <View style={[styles.root, { width, height: size }]}>
      <View style={styles.layer}>
        <Icon name="fire" size={size} color={OUTER} filled />
      </View>
      <View style={styles.layer}>
        <Icon name="fire" size={mid} color={MID} filled />
      </View>
      <View style={styles.layer}>
        <Icon name="fire" size={inner} color={INNER} filled />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  layer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
});
