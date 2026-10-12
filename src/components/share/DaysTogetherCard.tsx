import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';

import { ShareBrand } from './ShareBrand';

export const SHARE_CARD_W = 300;
export const SHARE_CARD_H = 375; // 4:5, the shape Instagram and most feeds like

/** The shareable "N days together" card. */
export function DaysTogetherCard({ days, names, since }: { days: number; names: string; since: Date }) {
  return (
    <LinearGradient
      colors={['#2B1B3D', '#6A2C5B', '#C9687A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}>
      <View style={styles.glow} />
      <View style={styles.heart}>
        <Icon name="heart" size={26} color="#FFFFFF" filled />
      </View>
      <View style={styles.middle}>
        <Text style={styles.number} adjustsFontSizeToFit numberOfLines={1}>
          {days.toLocaleString()}
        </Text>
        <Text style={styles.unit}>days together</Text>
        <Text style={styles.names} numberOfLines={1}>
          {names}
        </Text>
        <Text style={styles.since}>since {format(since, 'd MMMM yyyy')}</Text>
      </View>
      <ShareBrand />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: { width: SHARE_CARD_W, height: SHARE_CARD_H, padding: 24, justifyContent: 'space-between' },
  glow: {
    position: 'absolute',
    width: 260,
    height: 260,
    borderRadius: 130,
    right: -90,
    top: -110,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  heart: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  middle: { gap: 2 },
  number: { color: '#FFFFFF', fontSize: 88, fontWeight: '900', letterSpacing: -3, lineHeight: 94 },
  unit: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: -2 },
  names: { color: 'rgba(255,255,255,0.88)', fontSize: 17, fontWeight: '800', marginTop: 14 },
  since: { color: 'rgba(255,255,255,0.7)', fontSize: 14, fontWeight: '600' },
});
