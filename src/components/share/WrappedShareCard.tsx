import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';

import { SHARE_CARD_H, SHARE_CARD_W } from './DaysTogetherCard';
import { ShareBrand } from './ShareBrand';

export type WrappedStat = { icon: IconName; value: number; label: string };

const INK = '#000000';
const PAD = 18;
const GAP = 7;
/** Three tiles across the card's inner width. */
const TILE_W = (SHARE_CARD_W - PAD * 2 - GAP * 2) / 3;
/** A sticker colour per tile, like the onboarding cards. */
const TILE_TINTS = ['#FFD9CC', '#D7F2E3', '#FFE7A0', '#DCEBFF', '#FFD6DC', '#E3DDFF'] as const;

/**
 * The shareable Wrapped summary (4:5), in the same sticker style as the streak
 * and days-together cards: a bright card with a bold outline, a "Wrapped" badge,
 * your names, the year and your couple type, the year in six numbers on
 * coloured tiles, and the Moments pill, all centred.
 */
export function WrappedShareCard({
  year,
  names,
  stats,
  coupleType,
}: {
  year: number;
  names: string;
  stats: WrappedStat[];
  coupleType?: { icon: IconName; name: string };
  /** The story's colours (the sticker card uses its own). */
  colors?: readonly [string, string, ...string[]];
}) {
  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Wrapped {year}</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.names} numberOfLines={1} adjustsFontSizeToFit>
          {names}
        </Text>
        <Text style={styles.year} numberOfLines={1} adjustsFontSizeToFit>
          {year}
        </Text>
        {coupleType ? (
          <View style={styles.type}>
            <View style={styles.typeIcon}>
              <Icon name={coupleType.icon} size={14} color={INK} filled />
            </View>
            <Text style={styles.typeName} numberOfLines={1}>
              {coupleType.name}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.grid}>
        {stats.slice(0, 6).map((s, i) => (
          <View key={s.label} style={[styles.tile, { backgroundColor: TILE_TINTS[i % TILE_TINTS.length] }]}>
            <View style={styles.valueRow}>
              <Icon name={s.icon} size={13} color={INK} filled />
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

      <ShareBrand style={styles.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_W,
    height: SHARE_CARD_H,
    // Matches the share preview's rounded frame, so the border isn't clipped.
    borderRadius: 24,
    borderWidth: 3,
    borderColor: INK,
    backgroundColor: '#FFF3D6',
    paddingVertical: 18,
    paddingHorizontal: PAD,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', color: INK },

  hero: { alignItems: 'center', alignSelf: 'stretch' },
  names: { color: '#333333', fontSize: 15, fontWeight: '800' },
  year: { color: INK, fontSize: 54, fontWeight: '900', letterSpacing: -2.2, lineHeight: 58, textAlign: 'center' },
  type: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
    paddingLeft: 4,
    paddingRight: 12,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: '#FFFFFF',
  },
  typeIcon: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFE7A0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeName: { color: INK, fontSize: 13, fontWeight: '900', flexShrink: 1 },

  // Three across, two down.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP, justifyContent: 'center' },
  tile: {
    width: TILE_W,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: INK,
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: 3, maxWidth: '100%' },
  value: { color: INK, fontSize: 17, fontWeight: '900', letterSpacing: -0.4, flexShrink: 1 },
  label: { color: '#333333', fontSize: 10, fontWeight: '800', textAlign: 'center' },
  brand: { alignSelf: 'center' },
});
