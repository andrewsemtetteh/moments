/**
 * Earlier designs of the Handpicked area card, kept to come back to. Nothing imports this file, so
 * none of it (images included) is in the app.
 *
 * To try one again, in AreaGrid.tsx render it instead of `AreaCard`, with the same props:
 *   <AreaCardPhoto key={area.id} area={area} meta={meta} progress={progress} />
 *
 * - AreaCardOriginal: the first one. A gradient tile with "N to try", the name and a white Explore button.
 * - AreaCardGradient: the first redesign. The whole card is the button; a white line drawing in the
 *   corner, the name and progress at the bottom.
 * - AreaCardPhoto: the painted couple scene fills the card (area-photos/ next to this file), with a dark
 *   fade at the bottom for the name and progress.
 */
import * as Haptics from '@/lib/haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { ActivityArt } from '@/components/activities/explore/ActivityArt';
import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { shade } from '@/components/games/room-ui';
import type { Area, AreaId } from '@/lib/handpicked';

import { PlayCardGradient as PlayCard } from './PlayCardGradient';

export interface AreaCardProps {
  area: Area;
  /** "12 to try", or "3 of 8 done" once you've started. */
  meta: string;
  /** Share of the area's packs done (0–1), or null before you've started. */
  progress: number | null;
}

function useOpenArea(area: Area) {
  const router = useRouter();
  return () => {
    void Haptics.selectionAsync();
    router.push({ pathname: '/play/area/[id]', params: { id: area.id } });
  };
}

/* -------------------------------------------------------------------------- */
/* 1 · Original: gradient tile with an Explore button                         */
/* -------------------------------------------------------------------------- */

export function AreaCardOriginal({ area, meta }: AreaCardProps) {
  const open = useOpenArea(area);
  return (
    <View style={styles.cell}>
      <PlayCard
        layout="tile"
        tone={PLAY_TONES[area.tone]}
        badge={meta}
        title={area.title}
        cta="Explore"
        onPress={open}
      />
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* 2 · Gradient card, line drawing in the corner                               */
/* -------------------------------------------------------------------------- */

export function AreaCardGradient({ area, meta, progress }: AreaCardProps) {
  const open = useOpenArea(area);
  const tone = PLAY_TONES[area.tone];
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${area.title}, ${meta}`}
      accessibilityHint={area.blurb}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
      <LinearGradient
        colors={[shade(tone.accent, -0.02), shade(tone.accent, -0.32)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}>
        <View style={styles.glow} pointerEvents="none" />
        <View style={styles.art} pointerEvents="none">
          <ActivityArt id={area.art} size={84} accent="#FFFFFF" soft="rgba(255,255,255,0.22)" />
        </View>
        <BottomText title={area.title} meta={meta} progress={progress} />
      </LinearGradient>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */
/* 3 · Painted scene filling the card                                          */
/* -------------------------------------------------------------------------- */

/** Card-sized copies (600 px wide, ~50 KB) of the scenes in assets/images/play. */
const AREA_PHOTOS: Partial<Record<AreaId, ImageSourcePropType>> = {
  knowing: require('./area-photos/knowing.jpg'),
  story: require('./area-photos/story.jpg'),
  fun: require('./area-photos/fun.jpg'),
  romance: require('./area-photos/romance.jpg'),
  intimacy: require('./area-photos/intimacy.jpg'),
  communication: require('./area-photos/communication.jpg'),
  trust: require('./area-photos/trust.jpg'),
  conflict: require('./area-photos/conflict.jpg'),
  distance: require('./area-photos/distance.jpg'),
  home: require('./area-photos/home.jpg'),
  family: require('./area-photos/family.jpg'),
  money: require('./area-photos/money.jpg'),
  growth: require('./area-photos/growth.jpg'),
  future: require('./area-photos/future.jpg'),
};

export function AreaCardPhoto({ area, meta, progress }: AreaCardProps) {
  const open = useOpenArea(area);
  const tone = PLAY_TONES[area.tone];
  const photo = AREA_PHOTOS[area.id];
  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={`${area.title}, ${meta}`}
      accessibilityHint={area.blurb}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
      <View style={[styles.card, { backgroundColor: shade(tone.accent, -0.35) }]}>
        {photo ? <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : null}
        {/* Dark at the bottom, clear at the top: the words read on any picture. */}
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.35)', 'rgba(0,0,0,0.78)']}
          locations={[0.35, 0.62, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <BottomText title={area.title} meta={meta} progress={progress} shadow />
        <View style={styles.edge} pointerEvents="none" />
      </View>
    </Pressable>
  );
}

/* -------------------------------------------------------------------------- */

/** White name, meta line and progress bar at the bottom of a coloured card. */
function BottomText({
  title,
  meta,
  progress,
  shadow,
}: {
  title: string;
  meta: string;
  progress: number | null;
  shadow?: boolean;
}) {
  return (
    <View style={styles.text}>
      <Text style={[styles.title, shadow && styles.titleShadow]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
        {title}
      </Text>
      <Text style={styles.meta} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {meta}
      </Text>
      {progress !== null ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(6, Math.round(progress * 100))}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

const RADIUS = 26;

const styles = StyleSheet.create({
  cell: { flexBasis: '47%', flexGrow: 1 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.95 },
  card: {
    aspectRatio: 0.92,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    padding: 16,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.13)',
    right: -60,
    top: -64,
  },
  art: { position: 'absolute', top: 10, right: 8 },
  edge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  text: { gap: 4 },
  title: { color: '#FFFFFF', fontSize: 19, fontWeight: '800', letterSpacing: -0.35, lineHeight: 23 },
  titleShadow: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 6 },
  meta: { color: 'rgba(255,255,255,0.86)', fontSize: 13, fontWeight: '700' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)', overflow: 'hidden', marginTop: 6 },
  fill: { height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' },
});
