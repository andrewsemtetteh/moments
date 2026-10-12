import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';

import { ActivityArt, type ActivityArtId } from '@/components/activities/explore/ActivityArt';
import type { PlayTone } from '@/components/activities/explore/explore-catalog';
import { shade } from '@/components/games/room-ui';

interface PlayCardProps {
  tone: PlayTone;
  title: string;
  /** Small dark pill above the title. */
  badge?: string;
  sub?: string;
  cta?: string;
  art?: ActivityArtId;
  onPress: () => void;
  /** `wide`: full width or rail card. `tile`: compact card for the two-column area grid. */
  layout?: 'wide' | 'tile';
  width?: DimensionValue;
}

/** Bold gradient card in the tone's colour, with a soft glow, white type and a chunky white button. */
export function PlayCard({ tone, title, badge, sub, cta, art, onPress, layout = 'wide', width }: PlayCardProps) {
  const tile = layout === 'tile';
  const ink = shade(tone.accent, -0.5);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={cta ? `${cta} ${title}` : title}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}>
      <LinearGradient
        colors={[shade(tone.accent, -0.05), shade(tone.accent, -0.35)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={tile ? styles.tile : styles.wide}>
        <View style={tile ? styles.tileGlow : styles.wideGlow} pointerEvents="none" />

        <View style={tile ? styles.tileBody : styles.wideBody}>
          {badge ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText} numberOfLines={1}>
                {badge.toUpperCase()}
              </Text>
            </View>
          ) : null}
          <Text style={tile ? styles.tileTitle : styles.wideTitle} numberOfLines={2}>
            {title}
          </Text>
          {sub ? (
            <Text style={styles.sub} numberOfLines={2}>
              {sub}
            </Text>
          ) : null}
          {cta ? (
            <View style={[styles.cta, tile && styles.ctaTile]}>
              <Text style={[styles.ctaText, { color: ink }]}>{cta}</Text>
            </View>
          ) : null}
        </View>

        {art && !tile ? (
          <View style={styles.art} pointerEvents="none">
            <ActivityArt id={art} size={104} accent="#FFFFFF" soft="rgba(255,255,255,0.22)" />
          </View>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.985 }] },
  wide: {
    minHeight: 172,
    borderRadius: 28,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  wideGlow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.13)',
    right: -70,
    top: -80,
  },
  wideBody: { flex: 1, gap: 8, minWidth: 0 },
  tile: {
    minHeight: 168,
    borderRadius: 26,
    padding: 16,
    overflow: 'hidden',
  },
  tileGlow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.14)',
    right: -55,
    top: -60,
  },
  tileBody: { flex: 1, gap: 8, justifyContent: 'space-between' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  wideTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '900', letterSpacing: -0.4, lineHeight: 27 },
  tileTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900', letterSpacing: -0.3, lineHeight: 23 },
  sub: { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  cta: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 11,
    marginTop: 6,
    borderBottomWidth: 4,
    borderBottomColor: 'rgba(0,0,0,0.18)',
  },
  ctaTile: { paddingHorizontal: 16, paddingVertical: 9, marginTop: 0 },
  ctaText: { fontSize: 15, fontWeight: '900' },
  art: { width: 108, height: 108, alignItems: 'center', justifyContent: 'center', marginLeft: 4 },
});
