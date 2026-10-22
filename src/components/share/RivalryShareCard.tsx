import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';

import { SHARE_CARD_H, SHARE_CARD_W } from './DaysTogetherCard';
import { ShareBrand } from './ShareBrand';

const INK = '#000000';

/**
 * You two, head to head, as a shareable card (the trophy card's look): both names and all-time
 * wins, ties, and this season's score.
 */
export function RivalryShareCard({
  meName,
  themName,
  meWins,
  themWins,
  ties,
  seasonLine,
}: {
  meName: string;
  themName: string;
  meWins: number;
  themWins: number;
  ties: number;
  /** e.g. "October season: you lead 4–2". */
  seasonLine: string;
}) {
  const leader = meWins > themWins ? 'me' : themWins > meWins ? 'them' : null;
  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Icon name="swords" size={14} color={INK} />
        <Text style={styles.badgeText}>Head to head</Text>
      </View>

      <View style={styles.versus}>
        <Side name={meName} wins={meWins} lead={leader === 'me'} />
        <View style={styles.middle}>
          <Text style={styles.vs}>VS</Text>
          {ties ? <Text style={styles.ties}>{ties === 1 ? '1 tie' : `${ties} ties`}</Text> : null}
        </View>
        <Side name={themName} wins={themWins} lead={leader === 'them'} />
      </View>

      <Text style={styles.season} numberOfLines={2}>
        {seasonLine}
      </Text>
      <ShareBrand style={styles.brand} />
    </View>
  );
}

function Side({ name, wins, lead }: { name: string; wins: number; lead: boolean }) {
  return (
    <View style={styles.side}>
      <View style={[styles.crownSlot, !lead && styles.hidden]}>
        <Icon name="trophy" size={22} color={INK} filled />
      </View>
      <View style={[styles.disc, lead && styles.discLead]}>
        <Text style={styles.wins} adjustsFontSizeToFit numberOfLines={1}>
          {wins}
        </Text>
      </View>
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      <Text style={styles.winsLabel}>{wins === 1 ? 'win' : 'wins'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: SHARE_CARD_W,
    height: SHARE_CARD_H,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: INK,
    backgroundColor: '#FFE7A0',
    paddingVertical: 22,
    paddingHorizontal: 18,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: INK,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase', color: INK },
  versus: { flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' },
  side: { flex: 1, alignItems: 'center', gap: 4 },
  crownSlot: { height: 24, justifyContent: 'center' },
  hidden: { opacity: 0 },
  disc: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: INK,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  discLead: { backgroundColor: '#E3DDFF' },
  wins: { fontSize: 36, fontWeight: '900', letterSpacing: -1, color: INK },
  name: { fontSize: 16, fontWeight: '900', color: INK, maxWidth: '100%' },
  winsLabel: { fontSize: 12, fontWeight: '700', color: '#444444' },
  middle: { alignItems: 'center', gap: 2, paddingHorizontal: 4 },
  vs: { fontSize: 15, fontWeight: '900', letterSpacing: 1, color: INK },
  ties: { fontSize: 11, fontWeight: '700', color: '#444444' },
  season: { fontSize: 15, fontWeight: '800', color: INK, textAlign: 'center' },
  brand: { alignSelf: 'center' },
});
