import * as Haptics from '@/lib/haptics';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { shade } from '@/components/games/room-ui';
import { colorWithAlpha } from '@/components/ui/primitives';
import { usePackAnswers } from '@/hooks/play-queries';
import { AREAS, itemsForArea, answerHome, packProgress, type Area } from '@/lib/handpicked';
import { useAuthStore } from '@/stores';

import { AREA_ART } from './area-art';
import { illustrationPalette } from './illustration-palette';

/**
 * The Handpicked areas as a two-column grid. Each card is one tap target (no separate button): a
 * flat illustration of the area in its own colours, then the name and one line under it: how far
 * you've got, or how much there is to try.
 */
export function AreaGrid() {
  const userId = useAuthStore((s) => s.user?.id);
  const { data: answers } = usePackAnswers();

  // Your locked-in answers per pack, to show how far you are in each area.
  const answeredByPack = useMemo(() => {
    const byPack = new Map<string, Set<string>>();
    for (const a of answers ?? []) {
      if (a.user_id !== userId) continue;
      // Grouped by the part each answer belongs to (long sets show as parts).
      const home = answerHome(a);
      if (!byPack.has(home.packId)) byPack.set(home.packId, new Set());
      byPack.get(home.packId)!.add(home.questionId);
    }
    return byPack;
  }, [answers, userId]);

  return (
    <View style={styles.grid}>
      {AREAS.map((area) => {
        const items = itemsForArea(area.id);
        const packs = items.flatMap((i) => (i.kind === 'pack' ? [i] : []));
        const done = packs.filter((p) => packProgress(p.pack, answeredByPack.get(p.id) ?? new Set()).done).length;
        const started = packs.some((p) => (answeredByPack.get(p.id)?.size ?? 0) > 0);
        return (
          <AreaCard
            key={area.id}
            area={area}
            meta={started && packs.length ? `${done} of ${packs.length} done` : `${items.length} to try`}
            progress={started && packs.length ? done / packs.length : null}
          />
        );
      })}
    </View>
  );
}

function AreaCard({ area, meta, progress }: { area: Area; meta: string; progress: number | null }) {
  const router = useRouter();
  const c = useMemo(() => illustrationPalette(PLAY_TONES[area.tone]), [area]);
  const xml = useMemo(() => AREA_ART[area.id]?.(c) ?? null, [area.id, c]);
  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        router.push({ pathname: '/play/area/[id]', params: { id: area.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={`${area.title}, ${meta}`}
      accessibilityHint={area.blurb}
      style={({ pressed }) => [styles.cell, pressed && styles.pressed]}>
      <View style={[styles.card, { backgroundColor: c.bg }]}>
        {xml ? (
          <View style={styles.art} pointerEvents="none">
            <SvgXml xml={xml} width="100%" height="100%" />
          </View>
        ) : null}
        <View style={styles.text}>
          <Text style={[styles.title, { color: c.d }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {area.title}
          </Text>
          <Text style={[styles.meta, { color: shade(c.a, -0.3) }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {meta}
          </Text>
          {progress !== null ? (
            <View style={[styles.track, { backgroundColor: colorWithAlpha(c.a, 0.22) }]}>
              <View
                style={[styles.fill, { backgroundColor: c.a, width: `${Math.max(6, Math.round(progress * 100))}%` }]}
              />
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const RADIUS = 26;

const styles = StyleSheet.create({
  // Two equal columns, 12 apart (the page supplies the 16 pt side margins). Cards in a row match heights.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  cell: { flexBasis: '47%', flexGrow: 1 },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.95 },
  card: { flex: 1, borderRadius: RADIUS, borderCurve: 'continuous', overflow: 'hidden' },
  // The illustration: the top three quarters of the card's width.
  art: { width: '100%', aspectRatio: 200 / 150 },
  text: { paddingHorizontal: 14, paddingTop: 4, paddingBottom: 14, gap: 3 },
  title: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3, lineHeight: 21 },
  meta: { fontSize: 12, fontWeight: '700' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 6 },
  fill: { height: 4, borderRadius: 2 },
});
