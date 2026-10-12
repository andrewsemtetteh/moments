import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';

import { SHARE_CARD_H, SHARE_CARD_W } from './DaysTogetherCard';
import { ShareBrand } from './ShareBrand';

export type WrappedStat = { icon: IconName; value: number; label: string };

const PAD = 20;
const GAP = 8;
/** Three tiles across the card's inner width. */
const TILE_W = (SHARE_CARD_W - PAD * 2 - GAP * 2) / 3;

/**
 * The shareable Wrapped summary (4:5), everything centred: the brand along the top, then your names,
 * the year and your couple type, then the year in six numbers.
 */
export function WrappedShareCard({
  year,
  names,
  stats,
  coupleType,
  colors,
}: {
  year: number;
  names: string;
  stats: WrappedStat[];
  coupleType?: { icon: IconName; name: string };
  colors: readonly [string, string, ...string[]];
}) {
  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.glow} />
      <View style={styles.glowLow} />
      <View style={styles.scrim} />

      <View style={styles.top}>
        <ShareBrand size="sm" />
        <Text style={styles.topText}>Wrapped {year}</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Our year together</Text>
        <Text style={styles.names} numberOfLines={1} adjustsFontSizeToFit>
          {names}
        </Text>
        <Text style={styles.year} numberOfLines={1} adjustsFontSizeToFit>
          {year}
        </Text>
        {coupleType ? (
          <View style={styles.type}>
            <Icon name={coupleType.icon} size={15} color="#FFFFFF" filled />
            <Text style={styles.typeName} numberOfLines={1}>
              {coupleType.name}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.grid}>
        {stats.slice(0, 6).map((s) => (
          <View key={s.label} style={styles.tile}>
            <View style={styles.valueRow}>
              <Icon name={s.icon} size={13} color="#FFFFFF" filled />
              <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
                {s.value.toLocaleString()}
              </Text>
            </View>
            <Text style={styles.label} numberOfLines={1} adjustsFontSizeToFit>
              {s.label}
            </Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { width: SHARE_CARD_W, height: SHARE_CARD_H, padding: PAD, justifyContent: 'space-between' },
  glow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    right: -80,
    top: -100,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  glowLow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    left: -70,
    bottom: -60,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  // Same light shade as the stories, so white text reads on any colour.
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(0,0,0,0.12)' },

  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '900', letterSpacing: 0.3 },

  hero: { alignItems: 'center' },
  eyebrow: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  names: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', letterSpacing: -0.2, marginTop: 2 },
  year: {
    color: '#FFFFFF',
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2.5,
    lineHeight: 60,
    marginTop: 2,
    textAlign: 'center',
  },
  type: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: SHARE_CARD_W - PAD * 2,
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  typeName: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: -0.1, flexShrink: 1 },

  // Three across, two down.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  tile: {
    width: TILE_W,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    gap: 1,
  },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  value: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', letterSpacing: -0.4, flexShrink: 1 },
  label: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '700', textAlign: 'center' },
});
