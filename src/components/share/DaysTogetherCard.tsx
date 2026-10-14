import { format } from 'date-fns';
import { StyleSheet, Text, View } from 'react-native';

import { CoupleCharacters } from '@/components/onboarding/Characters';

import { ShareBrand } from './ShareBrand';

export const SHARE_CARD_W = 300;
export const SHARE_CARD_H = 375; // 4:5, the shape Instagram and most feeds like

const INK = '#000000';

/**
 * The shareable "N days together" card, in the same sticker style as the streak
 * achievement: a bright card with a bold outline, the couple characters under
 * their heart, the count, both names and since when, and the Moments pill.
 */
export function DaysTogetherCard({ days, names, since }: { days: number; names: string; since: Date }) {
  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Together</Text>
      </View>
      <CoupleCharacters width={150} />
      <View style={styles.middle}>
        <Text style={styles.count} adjustsFontSizeToFit numberOfLines={1}>
          {days.toLocaleString()}
        </Text>
        <Text style={styles.unit} numberOfLines={1}>
          {days === 1 ? 'day together' : 'days together'}
        </Text>
        {/* Names hidden for now (kept to bring back easily):
        <Text style={styles.names} numberOfLines={1}>
          {names}
        </Text>
        */}
        <Text style={styles.since} numberOfLines={1}>
          since {format(since, 'd MMMM yyyy')}
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
    backgroundColor: '#FFD6DC',
    paddingVertical: 20,
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
  middle: { alignItems: 'center', gap: 1 },
  count: { fontSize: 50, fontWeight: '900', letterSpacing: -1.8, color: INK, lineHeight: 54 },
  unit: { fontSize: 20, fontWeight: '900', letterSpacing: -0.4, color: INK },
  names: { fontSize: 13, fontWeight: '800', color: '#333333', marginTop: 4 },
  since: { fontSize: 12, fontWeight: '700', color: '#555555' },
  brand: { alignSelf: 'center' },
});
