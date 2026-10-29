import * as Haptics from '@/lib/haptics';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type DimensionValue } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { ActivityArt, type ActivityArtId } from '@/components/activities/explore/ActivityArt';
import type { PlayTone } from '@/components/activities/explore/explore-catalog';
import { Crown } from '@/components/ui/Crown';

import type { ArtPalette } from './area-art';
import { illustrationPalette } from './illustration-palette';

interface PlayCardProps {
  tone: PlayTone;
  title: string;
  /** Small label above the title ("Versus", "Today's pack · Romance"). */
  badge?: string;
  sub?: string;
  cta?: string;
  /** A flat drawing in the card's colours (area-art / game-art). Takes the place of `art`. */
  scene?: (c: ArtPalette) => string;
  /** The simpler line drawing, when there's no scene. */
  art?: ActivityArtId;
  onPress: () => void;
  width?: DimensionValue;
  /** Premium, not unlocked: a crown and PLUS in the corner (what a tap does is up to `onPress`). */
  locked?: boolean;
}

/**
 * The Play card, in the area cards' illustrated look: the tone's pastel paper, words on the left
 * in deep ink (label, title, a line, a small button), and a flat drawing on the right.
 */
export function PlayCard({ tone, title, badge, sub, cta, scene, art, onPress, width, locked }: PlayCardProps) {
  const c = useMemo(() => illustrationPalette(tone), [tone]);
  const xml = useMemo(() => (scene ? scene(c) : null), [scene, c]);

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${cta ? `${cta} ${title}` : title}${locked ? ', Plus only' : ''}`}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}>
      <View style={[styles.card, { backgroundColor: c.bg }]}>
        <View style={[styles.blob, { backgroundColor: c.l }]} pointerEvents="none" />
        {locked ? (
          <View style={styles.lock} pointerEvents="none">
            <Crown size={15} color={PLUS_INK} />
            <Text style={styles.lockText}>PLUS</Text>
          </View>
        ) : null}

        <View style={styles.body}>
          {badge ? (
            <View style={styles.badge}>
              <Text style={[styles.badgeText, { color: c.d }]} numberOfLines={1}>
                {badge.toUpperCase()}
              </Text>
            </View>
          ) : null}
          <Text style={[styles.title, { color: c.d }]} numberOfLines={3} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          {sub ? (
            <Text style={[styles.sub, { color: c.d }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
              {sub}
            </Text>
          ) : null}
          {cta ? (
            <View style={[styles.cta, { backgroundColor: c.d }]}>
              <Text style={styles.ctaText}>{cta}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.art} pointerEvents="none">
          {xml ? (
            <SvgXml xml={xml} width="100%" height="100%" />
          ) : art ? (
            <View style={styles.artCenter}>
              <ActivityArt id={art} size={104} accent={c.a} soft={c.l} />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const PLUS_INK = '#3A2A00';

const styles = StyleSheet.create({
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
  card: {
    minHeight: 168,
    borderRadius: 26,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  blob: { position: 'absolute', width: 170, height: 170, borderRadius: 85, right: -50, top: -70, opacity: 0.55 },
  body: { flex: 1, minWidth: 0, gap: 6, paddingVertical: 18, paddingLeft: 18, paddingRight: 4 },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4, lineHeight: 23 },
  sub: { fontSize: 13, fontWeight: '600', lineHeight: 18, opacity: 0.78 },
  cta: { alignSelf: 'flex-start', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 8, marginTop: 4 },
  ctaText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  // The drawing: a 4:3 scene down the right side.
  art: { width: '42%', aspectRatio: 200 / 150, marginRight: 6 },
  artCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  lock: {
    position: 'absolute',
    top: 12,
    right: 12,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFD54A',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  lockText: { color: PLUS_INK, fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
});
