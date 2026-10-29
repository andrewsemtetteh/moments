import { formatDistanceToNowStrict } from 'date-fns';
import * as Haptics from '@/lib/haptics';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { MoodPickerModal } from '@/components/home/MoodPickerModal';
import { Icon } from '@/components/ui/Icon';
import { MOOD_COLORS, MOOD_EMOJI, MOOD_LABELS, Radius, type ThemeColors } from '@/constants/design-system';
import { useMoodFrequency } from '@/hooks/queries';
import { useEnsurePartner } from '@/hooks/useEnsurePartner';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { getDefaultQuickMoods, getModalMoods, getQuickMoods, shouldShowMoodExpand } from '@/lib/mood-options';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { MoodLog } from '@/types/database';

interface MoodSnapshotProps {
  moods: Record<string, MoodLog>;
  onSelectMood?: (mood: string) => void;
  onViewHistory?: () => void;
  /** The theme picker's preview: sample moods and your person's name, in the real card. */
  sample?: { partnerName: string; myMood: string; partnerMood: string; partnerSetAt: string };
}

export function MoodSnapshot({ moods, onSelectMood, onViewHistory, sample }: MoodSnapshotProps) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  useEnsurePartner();
  const { data: frequentMoods = [], isPending: moodsLoading } = useMoodFrequency();
  const [showAllMoods, setShowAllMoods] = useState(false);
  const quickLimit = 4;

  const partnerId =
    partner?.id ??
    (user && relationship
      ? relationship.user_1_id === user.id
        ? relationship.user_2_id
        : relationship.user_1_id
      : null);

  const myMood: Pick<MoodLog, 'mood'> | null = sample
    ? { mood: sample.myMood as MoodLog['mood'] }
    : user
      ? moods[user.id]
      : null;
  const partnerMood: Pick<MoodLog, 'mood' | 'created_at'> | null = sample
    ? { mood: sample.partnerMood as MoodLog['mood'], created_at: sample.partnerSetAt }
    : partnerId
      ? moods[partnerId]
      : null;

  const quickMoods = useMemo(() => {
    if (moodsLoading) {
      return getDefaultQuickMoods(quickLimit);
    }
    return getQuickMoods(frequentMoods, myMood?.mood, quickLimit);
  }, [moodsLoading, frequentMoods, myMood?.mood, quickLimit]);
  const modalMoods = useMemo(() => getModalMoods(quickMoods), [quickMoods]);
  const showExpand = shouldShowMoodExpand(quickMoods);

  // Fly the tapped emoji from its chip up into the Me circle, then pop it there.
  const cardRef = useRef<View>(null);
  const meRef = useRef<View>(null);
  const chipRefs = useRef<Record<string, View | null>>({});
  const [flying, setFlying] = useState<string | null>(null);
  const t = useSharedValue(0);
  const from = useSharedValue({ x: 0, y: 0 });
  const to = useSharedValue({ x: 0, y: 0 });
  const pop = useSharedValue(1);

  const land = () => {
    setFlying(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    pop.value = withSequence(withTiming(1.32, { duration: 130 }), withSpring(1, { damping: 7, stiffness: 240 }));
  };

  const flyFrom = (mood: string, chip: View | null | undefined) => {
    const card = cardRef.current;
    const me = meRef.current;
    if (!card || !me || !chip) {
      land();
      return;
    }
    chip.measureLayout(card, (cx, cy, cw, ch) => {
      me.measureLayout(card, (mx, my, mw, mh) => {
        from.value = { x: cx + cw / 2, y: cy + ch / 2 - 6 };
        to.value = { x: mx + mw / 2, y: my + mh / 2 };
        t.value = 0;
        setFlying(mood);
        t.value = withTiming(1, { duration: 560, easing: Easing.out(Easing.cubic) }, (done) => {
          if (done) scheduleOnRN(land);
        });
      });
    });
  };

  const handleSelect = (mood: string, chip?: View | null) => {
    onSelectMood?.(mood);
    setShowAllMoods(false);
    flyFrom(mood, chip);
  };

  const flyStyle = useAnimatedStyle(() => {
    const k = t.value;
    const arc = Math.sin(Math.PI * k);
    const x = from.value.x + (to.value.x - from.value.x) * k;
    const y = from.value.y + (to.value.y - from.value.y) * k - 46 * arc;
    return {
      transform: [
        { translateX: x - 24 },
        { translateY: y - 24 },
        // Chip emoji (20) grows to the circle's (30), swelling mid flight.
        { scale: 1 + 0.5 * k + 0.35 * arc },
        { rotate: `${-18 * arc}deg` },
      ],
    };
  });
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));

  return (
    <View
      ref={cardRef}
      style={[
        styles.container,
        {
          backgroundColor: colors.tints.blush,
          // Same edge as the Settings cards: Paper's 2pt line, a crisp 1pt on soft themes, none otherwise.
          borderColor: colors.border,
          borderWidth: colors.boldBorder ? 2 : colors.sticker ? 1 : 0,
        },
      ]}>
      <View style={styles.headerRow}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>How we&apos;re feeling</Text>
        {onViewHistory && (
          <Pressable
            onPress={onViewHistory}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Mood history"
            style={styles.historyBtn}>
            <Icon name="time" size={22} color={colors.tintAccents?.blush ?? colors.text} />
          </Pressable>
        )}
      </View>

      <View style={styles.row}>
        <MoodBubble
          name="Me"
          mood={myMood?.mood}
          colors={colors}
          circleRef={meRef}
          emojiStyle={popStyle}
          hideEmoji={!!flying}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <MoodBubble
          name={sample?.partnerName ?? getFirstName(partner?.name) ?? 'Partner'}
          mood={partnerMood?.mood}
          setAt={partnerMood?.created_at}
          colors={colors}
        />
      </View>

      {onSelectMood && (
        <View style={styles.selector}>
          {quickMoods.map((m) => (
            <View
              key={m}
              style={styles.chipSlot}
              ref={(el) => {
                chipRefs.current[m] = el;
              }}>
              <MoodChip
                mood={m}
                active={myMood?.mood === m}
                colors={colors}
                onPress={() => handleSelect(m, chipRefs.current[m])}
              />
            </View>
          ))}
          {showExpand && (
            <View
              style={styles.chipSlot}
              ref={(el) => {
                chipRefs.current['__more'] = el;
              }}>
              <Pressable
                onPress={() => setShowAllMoods(true)}
                accessibilityLabel="More moods"
                style={({ pressed }) => [
                  styles.moreBtn,
                  {
                    backgroundColor: colors.isDark ? 'rgba(255,255,255,0.07)' : colors.surfaceElevated,
                    // Same edge as the card and the emoji chips.
                    borderColor: colors.border,
                    borderWidth: cardEdge(colors),
                  },
                  lightCard(colors) && { backgroundColor: FROSTED },
                  colors.boldBorder && { backgroundColor: colors.background, borderWidth: 2 },
                  pressed && styles.pressed,
                ]}>
                <Icon name="plus" size={22} color={colors.tintAccents?.blush ?? colors.accent} />
                <Text style={[styles.moreText, { color: colors.textSecondary }]} numberOfLines={1}>
                  More
                </Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      {flying ? (
        <Animated.Text pointerEvents="none" style={[styles.flyEmoji, flyStyle]}>
          {MOOD_EMOJI[flying]}
        </Animated.Text>
      ) : null}

      <MoodPickerModal
        visible={showAllMoods}
        moods={modalMoods}
        selected={myMood?.mood}
        onSelect={(m) => handleSelect(m, chipRefs.current['__more'])}
        onClose={() => setShowAllMoods(false)}
      />
    </View>
  );
}

/** The Settings cards' edge: Paper's 2pt line, a crisp 1pt on soft themes, none otherwise. */
function cardEdge(colors: ThemeColors): number {
  return colors.boldBorder ? 2 : colors.sticker ? 1 : 0;
}

function MoodChip({
  mood,
  active,
  colors,
  onPress,
}: {
  mood: string;
  active: boolean;
  colors: ThemeColors;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.moodBtn,
        {
          // Dark themes: a faint see-through fill, so it takes on the card's colour instead of a grey patch.
          backgroundColor: active
            ? MOOD_COLORS[mood] + '33'
            : colors.isDark
              ? 'rgba(255,255,255,0.07)'
              : colors.surfaceElevated,
          // At rest: the same edge as the card (and Settings). Picked: its mood colour.
          borderColor: active ? MOOD_COLORS[mood] : cardEdge(colors) ? colors.border : 'transparent',
          borderWidth: active ? Math.max(1.5, cardEdge(colors)) : cardEdge(colors),
        },
        // Light themes (the pink card): frosted white chips; the picked one solid white with an ink outline.
        lightCard(colors) && {
          backgroundColor: active ? '#FFFFFF' : FROSTED,
          borderColor: active ? colors.text : cardEdge(colors) ? colors.border : 'transparent',
          borderWidth: active ? 2 : cardEdge(colors),
        },
        // Outlined themes (Ink, Pop): white sticker chips with black outlines; the picked mood fills with its colour.
        colors.boldBorder && {
          backgroundColor: active ? MOOD_COLORS[mood] : colors.background,
          borderColor: colors.border,
          borderWidth: 2,
        },
        pressed && styles.pressed,
      ]}>
      <Text style={styles.moodEmoji}>{MOOD_EMOJI[mood]}</Text>
      <Text
        style={[
          styles.moodText,
          { color: active && lightCard(colors) ? colors.text : colors.textSecondary },
          active && lightCard(colors) && styles.moodTextOn,
        ]}
        numberOfLines={1}>
        {MOOD_LABELS[mood]}
      </Text>
    </Pressable>
  );
}

function MoodBubble({
  name,
  mood,
  setAt,
  colors,
  circleRef,
  emojiStyle,
  hideEmoji,
}: {
  name: string;
  mood?: string;
  /** When it was set, shown for your partner ("Loved · 2h ago"). */
  setAt?: string;
  colors: ThemeColors;
  /** Where a picked mood flies to (yours only). */
  circleRef?: React.Ref<View>;
  emojiStyle?: React.ComponentProps<typeof Animated.Text>['style'];
  /** While a mood is flying in, the circle waits for it. */
  hideEmoji?: boolean;
}) {
  const tint = mood ? MOOD_COLORS[mood] : colors.surfaceElevated;
  return (
    <View style={styles.bubble}>
      <View
        ref={circleRef}
        style={[
          styles.moodCircle,
          { backgroundColor: mood ? tint + '2A' : colors.surfaceElevated, borderColor: mood ? tint : colors.border },
          // Light themes: solid white so the emoji pops, with a strong ring in the mood's colour.
          lightCard(colors) && {
            backgroundColor: mood ? '#FFFFFF' : FROSTED,
            borderWidth: mood ? 3 : 2,
            borderColor: mood ? tint : 'transparent',
          },
        ]}>
        <Animated.Text style={[styles.emoji, emojiStyle, hideEmoji && styles.hidden]}>
          {mood ? MOOD_EMOJI[mood] : '·'}
        </Animated.Text>
      </View>
      <Text style={[styles.name, { color: colors.text }]}>{name}</Text>
      <Text style={[styles.moodLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {mood ? MOOD_LABELS[mood] : 'Not set'}
        {mood && setAt ? ` · ${shortAgo(setAt)}` : ''}
      </Text>
    </View>
  );
}

/** "2h ago", "5m ago", "just now". */
function shortAgo(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return 'just now';
  return `${formatDistanceToNowStrict(new Date(iso))
    .replace(/ seconds?/, 's')
    .replace(/ minutes?/, 'm')
    .replace(/ hours?/, 'h')
    .replace(/ days?/, 'd')
    .replace(/ months?/, 'mo')
    .replace(/ years?/, 'y')} ago`;
}

export function LoadingState() {
  const { colors } = useTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

/** The soft light themes, where the card is a pastel (pink): see-through mood tints blend into it there. */
function lightCard(colors: ThemeColors) {
  return !colors.isDark && !colors.boldBorder;
}
/** Frosted white for chips on the pink card. */
const FROSTED = 'rgba(255,255,255,0.62)';

const styles = StyleSheet.create({
  container: {
    // Matches the Settings cards' corners.
    borderRadius: 22,
    padding: 16,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '800' },
  historyBtn: { width: 36, height: 36, marginRight: -8, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  divider: { width: 1, height: 56, marginHorizontal: 12 },
  bubble: { flex: 1, alignItems: 'center', gap: 5 },
  moodCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  emoji: { fontSize: 30 },
  name: { fontSize: 15, fontWeight: '700' },
  moodLabel: { fontSize: 13 },
  selector: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 6,
    marginTop: 18,
  },
  chipSlot: { flex: 1, minWidth: 0 },
  flyEmoji: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 48,
    height: 48,
    fontSize: 20,
    lineHeight: 48,
    textAlign: 'center',
    zIndex: 10,
  },
  hidden: { opacity: 0 },
  moodBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: Radius.md,
  },
  moodEmoji: { fontSize: 20 },
  moodText: { fontSize: 10, marginTop: 2, fontWeight: '600', textAlign: 'center' },
  moodTextOn: { fontWeight: '900' },
  moreBtn: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: Radius.md,
  },
  moreText: { fontSize: 10, marginTop: 2, fontWeight: '600', textAlign: 'center' },
  pressed: { opacity: 0.7 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
});
