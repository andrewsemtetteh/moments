import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing, type ThemeColors } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';

/**
 * The pieces every Play page is built from, so the pages stay alike and follow the theme
 * (bold borders, sticker) in one place. The main button is `ChunkyButton` (games/room-ui).
 */

/** Side padding of every Play page. */
export const PLAY_GUTTER = Spacing.lg;

/** Card edge on Play: hairline normally, thicker on the bold and sticker themes. */
export function playEdge(colors: ThemeColors): number {
  return colors.boldBorder ? 2 : colors.sticker ? 1.5 : StyleSheet.hairlineWidth;
}

/** A Play card's surface: one radius, background and border everywhere. `selected` tints it. */
export function playCardStyle(colors: ThemeColors, selected = false): ViewStyle {
  return {
    borderRadius: Radius.lg,
    borderWidth: selected ? Math.max(1.5, playEdge(colors)) : playEdge(colors),
    backgroundColor: selected ? colors.accentSoft : colors.surfaceElevated,
    borderColor: selected ? colors.accent : colors.border,
  };
}

/** A card container (answers, scores, nudges…). */
export function PlayCardBox({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[playCardStyle(colors), styles.box, style]}>{children}</View>;
}

/** One chip for every filter and option row on Play. */
export function PlayChip({
  label,
  selected,
  onPress,
  wide,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Shown but not changeable (e.g. only the host sets it). */
  disabled?: boolean;
  /** A short label (a number) gets a minimum width so a row of them lines up. */
  wide?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: !!disabled }}
      style={({ pressed }) => [
        styles.chip,
        wide && styles.chipWide,
        {
          borderWidth: playEdge(colors),
          backgroundColor: selected ? colors.accent : colors.surfaceElevated,
          borderColor: selected ? colors.accent : colors.border,
          opacity: disabled && !selected ? 0.55 : pressed ? 0.85 : 1,
        },
      ]}>
      <Text style={[styles.chipText, { color: selected ? colors.onAccent : colors.text }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * The tone-coloured band under a Play page's header: a pill (optional), a line of intro in white,
 * then anything else (progress, steps).
 */
export function PlayHero({
  color,
  pill,
  blurb,
  note,
  children,
  minHeight,
}: {
  color: string;
  pill?: string;
  blurb?: string;
  /** A smaller line under the blurb ("6 questions. Answer on your own…"). */
  note?: string;
  children?: ReactNode;
  minHeight?: number;
}) {
  return (
    <View style={[styles.hero, { backgroundColor: color, minHeight }]}>
      <View style={styles.heroBody}>
        {pill ? <PlayPill label={pill} /> : null}
        {blurb ? <Text style={styles.heroBlurb}>{blurb}</Text> : null}
        {note ? <Text style={styles.heroNote}>{note}</Text> : null}
      </View>
      {children ? <View style={styles.heroExtra}>{children}</View> : null}
    </View>
  );
}

/** Small capitals on a dark wash, over a coloured band or card ("VERSUS", "QUESTION 2 OF 8"). */
export function PlayPill({ label }: { label: string }) {
  return (
    <View style={styles.heroPill}>
      <Text style={styles.heroPillText}>{label.toUpperCase()}</Text>
    </View>
  );
}

/** Text sizes on Play pages. */
export const PlayType = StyleSheet.create({
  /** A group or section heading ("Your stats", an area's name). */
  section: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3 },
  /** A field's label ("Vibe", "Rounds"). */
  label: { fontSize: 15, fontWeight: '800' },
  /** A card's title. */
  title: { fontSize: 15, fontWeight: '800' },
  /** Small capitals over a title. */
  eyebrow: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  /** Supporting text. */
  body: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
});

const styles = StyleSheet.create({
  box: { padding: 14, gap: 10 },
  chip: { borderRadius: Radius.pill, paddingHorizontal: 16, height: 40, justifyContent: 'center' },
  chipWide: { minWidth: 64, alignItems: 'center' },
  chipText: { fontSize: 14, fontWeight: '700' },
  hero: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingTop: 8,
    paddingBottom: 28,
    justifyContent: 'flex-end',
    gap: 18,
  },
  heroBody: { paddingHorizontal: Spacing.xl, gap: 12 },
  heroExtra: { paddingHorizontal: Spacing.xl },
  heroPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  heroPillText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900', letterSpacing: 1.1 },
  heroBlurb: { color: '#FFFFFF', fontSize: 20, fontWeight: '700', lineHeight: 27, letterSpacing: -0.3 },
  heroNote: { color: 'rgba(255,255,255,0.85)', fontSize: 15, fontWeight: '600', lineHeight: 21, marginTop: -4 },
});
