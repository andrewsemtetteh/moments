import { format } from 'date-fns';
import { StyleSheet, Text, View } from 'react-native';

import { StickerCake } from '@/components/home/StickerCake';

import { SHARE_CARD_H, SHARE_CARD_W } from './DaysTogetherCard';
import { ShareBrand } from './ShareBrand';

const INK = '#000000';

/**
 * The shareable birthday, in the same sticker style as the other achievements: a
 * butter-yellow card with the sticker cake, whose birthday, the age, the date and the
 * Moments pill.
 */
export function BirthdayShareCard({
  name,
  age,
  date = new Date(),
}: {
  name: string;
  age: number | null;
  date?: Date;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Birthday</Text>
      </View>
      <StickerCake size={118} />
      <View style={styles.middle}>
        <Text style={styles.title} adjustsFontSizeToFit numberOfLines={2}>
          {`Happy birthday, ${name}`}
        </Text>
        {age ? (
          <Text style={styles.unit} numberOfLines={1}>
            {`${age} today`}
          </Text>
        ) : null}
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
    backgroundColor: '#FFEBA8',
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
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -1, color: INK, lineHeight: 34, textAlign: 'center' },
  unit: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4, color: INK },
  date: { fontSize: 13, fontWeight: '700', color: '#444444', marginTop: 2 },
  brand: { alignSelf: 'center' },
});
