import { format } from 'date-fns';
import { StyleSheet, Text, View } from 'react-native';

import { StickerHeart } from '@/components/home/StickerHeart';

import { SHARE_CARD_H, SHARE_CARD_W } from './DaysTogetherCard';
import { ShareBrand } from './ShareBrand';

const INK = '#000000';

/**
 * The shareable together milestone, in the same sticker style as the streak
 * achievement: a pink card with the sticker heart, the count, "days in a row
 * together", the date, and the Moments pill (centred).
 */
export function TogetherShareCard({ count, date = new Date() }: { count: number; date?: Date }) {
  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Together milestone</Text>
      </View>
      <StickerHeart size={110} />
      <View style={styles.middle}>
        <Text style={styles.count} adjustsFontSizeToFit numberOfLines={1}>
          {count.toLocaleString()}
        </Text>
        <Text style={styles.unit} numberOfLines={1}>
          days in a row together
        </Text>
        <Text style={styles.date} numberOfLines={1}>
          {format(date, 'd MMM yyyy')}
        </Text>
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
    backgroundColor: '#FFD6E0',
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
  unit: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4, color: INK },
  date: { fontSize: 13, fontWeight: '700', color: '#444444', marginTop: 2 },
  brand: { alignSelf: 'center' },
});
