import * as Haptics from '@/lib/haptics';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import type { PlayTone } from '@/components/activities/explore/explore-catalog';
import { shade } from '@/components/games/room-ui';
import { Icon } from '@/components/ui/Icon';
import { Avatar, colorWithAlpha } from '@/components/ui/primitives';
import { useAnsweredByPack } from '@/hooks/play-queries';
import { DEPTHS, packProgress, type HandpickedItem, type ItemFormat } from '@/lib/handpicked';
import { useAuthStore, useRelationshipStore } from '@/stores';

type Progress = { answered: number; total: number; done: boolean };

const FORMAT_LABEL: Record<ItemFormat, string> = {
  questions: 'Questions',
  quizzes: 'Quiz',
  prompts: 'Cards',
  activities: 'To do',
  games: 'Game',
};

/** What a set holds, for "6 questions" in its row. */
const COUNT_NOUN: Record<ItemFormat, [string, string]> = {
  questions: ['question', 'questions'],
  quizzes: ['question', 'questions'],
  prompts: ['card', 'cards'],
  activities: ['thing to do', 'things to do'],
  games: ['round', 'rounds'],
};

/**
 * Your progress in each set, and who has finished it (you, your partner, or both), for the rows.
 */
export function useSetProgress() {
  const { mine, theirs } = useAnsweredByPack();
  const me = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  return useMemo(() => {
    const progressOf = (item: HandpickedItem) =>
      item.kind === 'pack' ? packProgress(item.pack, mine.get(item.id) ?? new Set()) : null;
    const doneByOf = (item: HandpickedItem) => {
      if (item.kind !== 'pack') return [];
      const list: { name: string; avatar?: string | null }[] = [];
      if (me && packProgress(item.pack, mine.get(item.id) ?? new Set()).done) list.push({ name: me.name ?? 'You', avatar: me.avatar_url });
      if (partner && packProgress(item.pack, theirs.get(item.id) ?? new Set()).done) {
        list.push({ name: partner.name ?? 'Your partner', avatar: partner.avatar_url });
      }
      return list;
    };
    return { mine, progressOf, doneByOf };
  }, [mine, theirs, me, partner]);
}

/**
 * A row's title and the line under it: the set's name, then its kind (when the page mixes
 * kinds), depth, and "Part 2 of 3" or how many it holds.
 */
export function packRowText(item: HandpickedItem, progress: Progress | null, { withFormat }: { withFormat: boolean }) {
  const part = item.kind === 'pack' ? item.pack.part : undefined;
  const depth = DEPTHS.find((d) => d.id === item.depth)?.label ?? '';
  const count = progress ? `${progress.total} ${COUNT_NOUN[item.format][progress.total === 1 ? 0 : 1]}` : null;
  // Guess quizzes are named as such everywhere, so they stand out from plain quizzes.
  const guess = item.kind === 'pack' && !!item.pack.guessPartner;
  const kind = guess ? 'Guess quiz' : withFormat ? FORMAT_LABEL[item.format] : null;
  const meta = [kind, depth, part ? `Part ${part.index} of ${part.count}` : count]
    .filter(Boolean)
    .join(' · ');
  return { title: part?.setTitle ?? item.title, meta };
}

interface PackRowProps {
  tone: PlayTone;
  title: string;
  /** One line under the title ("Questions · Light · 3 questions"). */
  meta: string;
  format: ItemFormat;
  progress: Progress | null;
  /** Who has finished it (you, your partner, or both): their photos with a tick on the right. */
  doneBy?: { name: string; avatar?: string | null }[];
  onPress: () => void;
}

/**
 * A set in an area's list, in the area card's look: the area's pastel paper, a small flat
 * drawing of what kind of set it is, the title in deep ink, and where you are on the right.
 */
export function PackRow({ tone, title, meta, format, progress, doneBy = [], onPress }: PackRowProps) {
  const c = useMemo(() => palette(tone), [tone]);
  const xml = useMemo(() => GLYPHS[format](c), [format, c]);
  const done = !!progress?.done;
  const started = !!progress && progress.answered > 0 && !done;
  const status = done ? 'done' : started ? `${progress!.answered} of ${progress!.total} answered` : 'not started';

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${meta}. ${status}`}
      style={({ pressed }) => [styles.card, { backgroundColor: c.bg }, pressed && styles.pressed]}>
      {/* The same soft circle the area cards have behind their scenes. */}
      <View style={[styles.blob, { backgroundColor: c.l }]} pointerEvents="none" />

      <View style={styles.top}>
        <View style={styles.tile}>
          <SvgXml xml={xml} width={44} height={44} />
        </View>

        <View style={styles.body}>
          <Text style={[styles.title, { color: c.d }]} numberOfLines={2} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          <Text style={[styles.meta, { color: shade(c.a, -0.3) }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {meta}
          </Text>
          {started ? (
            <View style={[styles.track, { backgroundColor: colorWithAlpha(c.a, 0.22) }]}>
              <View
                style={[
                  styles.fill,
                  { backgroundColor: c.a, width: `${Math.max(6, Math.round((progress!.answered / progress!.total) * 100))}%` },
                ]}
              />
            </View>
          ) : null}
        </View>

        {doneBy.length ? (
          <View
            style={styles.doneBy}
            accessibilityLabel={`Done by ${doneBy.map((p) => p.name).join(' and ')}`}>
            {doneBy.map((p, i) => (
              <View key={`${p.name}-${i}`} style={[styles.doneAvatar, { borderColor: c.bg }, i > 0 && styles.doneOverlap]}>
                <Avatar name={p.name} imageUrl={p.avatar ?? undefined} size={28} />
              </View>
            ))}
            <View style={[styles.doneTick, { backgroundColor: c.d, borderColor: c.bg }]}>
              <Icon name="check" size={10} color="#FFFFFF" />
            </View>
          </View>
        ) : started ? (
          <Text style={[styles.count, { color: c.d }]}>
            {progress!.answered}/{progress!.total}
          </Text>
        ) : (
          <View style={[styles.status, styles.go]}>
            <Icon name="chevronRight" size={16} color={c.d} />
          </View>
        )}
      </View>
    </Pressable>
  );
}

type Palette = { bg: string; a: string; d: string; l: string; w: string; y: string; k: string };

/** The area card's colours (see AreaGrid): pastel paper, the tone, a deep ink and a light tint. */
function palette(tone: PlayTone): Palette {
  return {
    bg: tone.wash[1],
    a: tone.accent,
    d: shade(tone.accent, -0.55),
    l: mixWithWhite(tone.accent, 0.6),
    w: '#FFFFFF',
    y: '#FFC857',
    k: '#FF7A9A',
  };
}

function mixWithWhite(hex: string, t: number): string {
  const h = hex.replace('#', '');
  const rgb = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `#${rgb.map((v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;

/** Small flat drawings, one per kind of set, in the area scenes' style (ink outlines, no faces). */
const GLYPHS: Record<ItemFormat, (c: Palette) => string> = {
  // A speech bubble with three dots: questions to answer.
  questions: (c) =>
    svg(
      `<path d="M14 12h36a10 10 0 0 1 10 10v18a10 10 0 0 1-10 10H30l-11 9 2-9h-7A10 10 0 0 1 4 40V22a10 10 0 0 1 10-10z" fill="${c.a}" stroke="${c.d}" stroke-width="2.5" stroke-linejoin="round"/>` +
        `<circle cx="20" cy="31" r="3.6" fill="${c.w}"/><circle cx="32" cy="31" r="3.6" fill="${c.w}"/><circle cx="44" cy="31" r="3.6" fill="${c.w}"/>`,
    ),
  // A little answer card: one pick ticked, one not.
  quizzes: (c) =>
    svg(
      `<rect x="8" y="6" width="48" height="52" rx="8" fill="${c.w}" stroke="${c.d}" stroke-width="2.5"/>` +
        `<rect x="15" y="15" width="34" height="12" rx="6" fill="${c.a}"/><path d="M20 21l3 3 6-6" fill="none" stroke="${c.w}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>` +
        `<rect x="15" y="33" width="34" height="12" rx="6" fill="${c.l}"/><circle cx="21" cy="39" r="2.6" fill="${c.w}"/>`,
    ),
  // Two talk-about cards, one on the other.
  prompts: (c) =>
    svg(
      `<g transform="rotate(-10 30 34)"><rect x="8" y="10" width="38" height="46" rx="7" fill="${c.l}" stroke="${c.d}" stroke-width="2.5"/></g>` +
        `<g transform="rotate(7 38 32)"><rect x="20" y="8" width="38" height="46" rx="7" fill="${c.w}" stroke="${c.d}" stroke-width="2.5"/>` +
        `<rect x="27" y="18" width="24" height="4" rx="2" fill="${c.a}"/><rect x="27" y="27" width="18" height="4" rx="2" fill="${c.a}" opacity=".6"/>` +
        `<path d="M39 46s-5-3-6.4-6c-1-2.7.7-5.3 3.3-5.3 1.3 0 2.4.7 3.1 1.8.7-1.1 1.8-1.8 3.1-1.8 2.6 0 4.3 2.6 3.3 5.3C43.9 43 39 46 39 46z" fill="${c.k}"/></g>`,
    ),
  // A flag on a pole: something to go and do.
  activities: (c) =>
    svg(
      `<path d="M16 58V8" stroke="${c.d}" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M17 10h32l-7 10 7 10H17z" fill="${c.a}" stroke="${c.d}" stroke-width="2.5" stroke-linejoin="round"/>` +
        `<circle cx="30" cy="20" r="3.5" fill="${c.w}"/><ellipse cx="16" cy="58" rx="9" ry="3" fill="${c.l}"/>`,
    ),
  // Two dice, one tumbling: a game.
  games: (c) =>
    svg(
      `<g transform="rotate(-12 22 36)"><rect x="6" y="20" width="32" height="32" rx="7" fill="${c.w}" stroke="${c.d}" stroke-width="2.5"/>` +
        `<circle cx="15" cy="29" r="3" fill="${c.d}"/><circle cx="29" cy="43" r="3" fill="${c.d}"/><circle cx="22" cy="36" r="3" fill="${c.d}"/></g>` +
        `<g transform="rotate(14 44 26)"><rect x="28" y="8" width="30" height="30" rx="7" fill="${c.a}" stroke="${c.d}" stroke-width="2.5"/>` +
        `<circle cx="37" cy="17" r="2.8" fill="${c.w}"/><circle cx="49" cy="17" r="2.8" fill="${c.w}"/><circle cx="37" cy="29" r="2.8" fill="${c.w}"/><circle cx="49" cy="29" r="2.8" fill="${c.w}"/></g>`,
    ),
};

const styles = StyleSheet.create({
  card: { borderRadius: 22, borderCurve: 'continuous', overflow: 'hidden', paddingVertical: 12, paddingLeft: 12, paddingRight: 14 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
  blob: { position: 'absolute', width: 120, height: 120, borderRadius: 60, right: -44, top: -54, opacity: 0.55 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0, gap: 3 },
  title: { fontSize: 16, fontWeight: '800', letterSpacing: -0.3, lineHeight: 20 },
  meta: { fontSize: 12, fontWeight: '700' },
  track: { height: 4, borderRadius: 2, overflow: 'hidden', marginTop: 5 },
  fill: { height: 4, borderRadius: 2 },
  status: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  go: { backgroundColor: 'rgba(255,255,255,0.75)' },
  // Who's finished: photos overlapping a little, a tick on the last one's corner.
  doneBy: { flexDirection: 'row', alignItems: 'center', paddingRight: 4 },
  doneAvatar: { borderWidth: 2, borderRadius: 16 },
  doneOverlap: { marginLeft: -10 },
  doneTick: {
    position: 'absolute',
    right: 0,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
});
