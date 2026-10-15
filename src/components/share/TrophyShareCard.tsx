import { StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/ui/Icon';

import { SHARE_CARD_H, SHARE_CARD_W } from './DaysTogetherCard';
import { ShareBrand } from './ShareBrand';

const INK = '#000000';

/**
 * A trophy from the Trophy shelf, shareable like the streak achievement: a
 * lavender sticker card with the trophy on a white disc, its name, what it
 * took, and the Moments pill (centred).
 */
export function TrophyShareCard({ icon, title, hint }: { icon: IconName; title: string; hint: string }) {
  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>Trophy unlocked</Text>
      </View>
      <View style={styles.disc}>
        <Icon name={icon} size={58} color={INK} filled />
      </View>
      <View style={styles.middle}>
        <Text style={styles.title} adjustsFontSizeToFit numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.hint} numberOfLines={2}>
          {hint}
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
    backgroundColor: '#E3DDFF',
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
  disc: {
    width: 116,
    height: 116,
    borderRadius: 58,
    borderWidth: 3,
    borderColor: INK,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { alignItems: 'center', gap: 4, alignSelf: 'stretch' },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.8, color: INK, textAlign: 'center' },
  hint: { fontSize: 14, fontWeight: '700', color: '#444444', textAlign: 'center' },
  brand: { alignSelf: 'center' },
});
