import { format } from 'date-fns';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';

import { SHARE_CARD_H, SHARE_CARD_W } from './DaysTogetherCard';
import { ShareBrand } from './ShareBrand';

const INK = '#000000';

/**
 * A title from The road on Your progress (Sweethearts, Lovebirds…), shareable
 * like the streak and trophy achievements: a blue sticker card with a star medal,
 * the title, the levels it covers, the date, and the Moments pill (centred).
 */
export function TitleShareCard({ title, line, date = new Date() }: { title: string; line: string; date?: Date }) {
  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Couple title unlocked</Text>
      </View>
      <View style={styles.medal}>
        <Icon name="star" size={56} color={INK} filled />
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} adjustsFontSizeToFit numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.line} numberOfLines={1}>
          {line}
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
    backgroundColor: '#DCEBFF',
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
  medal: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 3,
    borderColor: INK,
    backgroundColor: '#FFE7A0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { alignItems: 'center', gap: 4, alignSelf: 'stretch' },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.8, color: INK, textAlign: 'center' },
  line: { fontSize: 16, fontWeight: '800', color: INK },
  date: { fontSize: 13, fontWeight: '700', color: '#444444' },
  brand: { alignSelf: 'center' },
});
