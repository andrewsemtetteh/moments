import { format } from 'date-fns';
import { StyleSheet, Text, View } from 'react-native';

import { StickerFlame } from '@/components/home/StickerFlame';

import { SHARE_CARD_H, SHARE_CARD_W } from './DaysTogetherCard';
import { ShareBrand } from './ShareBrand';

const INK = '#000000';

/**
 * The shareable streak achievement: a yellow sticker card with the flame
 * character, the count, both names and the date, and the Moments pill.
 */
export function StreakShareCard({
  count,
  names,
  headline,
  date = new Date(),
}: {
  count: number;
  names: string;
  /** e.g. "One week together" on a milestone; defaults to "day streak". */
  headline?: string;
  date?: Date;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Achievement unlocked</Text>
      </View>
      <StickerFlame size={104} face />
      <View style={styles.middle}>
        <Text style={styles.count} adjustsFontSizeToFit numberOfLines={1}>
          {count.toLocaleString()}
        </Text>
        <Text style={styles.unit} numberOfLines={1}>
          {headline ?? 'day streak'}
        </Text>
        <Text style={styles.names} numberOfLines={1}>
          {names} · {format(date, 'd MMM yyyy')}
        </Text>
      </View>
      <ShareBrand />
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
    backgroundColor: '#FFE7A0',
    paddingVertical: 22,
    paddingHorizontal: 20,
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
  middle: { alignItems: 'center', gap: 2 },
  count: { fontSize: 52, fontWeight: '900', letterSpacing: -1.8, color: INK, lineHeight: 56 },
  unit: { fontSize: 21, fontWeight: '900', letterSpacing: -0.4, color: INK },
  names: { fontSize: 13, fontWeight: '700', color: '#444444', marginTop: 2 },
});
