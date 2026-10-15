import * as Haptics from '@/lib/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StickerFlame } from '@/components/home/StickerFlame';
import { Icon } from '@/components/ui/Icon';
import { DashedRing } from '@/components/ui/DashedRing';
import { Avatar } from '@/components/ui/primitives';
import { Spacing, type ThemeColors } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { STREAK_COLORS } from '@/lib/streak-colors';
import { buildStreakWeek, type StreakDayCell } from '@/lib/streak-days';
import { isStreakVisuallyAtRisk } from '@/lib/streak-reminder-timing';
import type { StreakStatus, UserProfile } from '@/types/database';

/** Blend a #rrggbb color toward black (amount < 0) or white (amount > 0). */
export function shadeHex(hex: string, amount: number): string {
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const target = amount < 0 ? 0 : 255;
  const t = Math.abs(amount);
  const ch = (i: number) => {
    const v = parseInt(h.slice(i, i + 2), 16);
    return Math.round(v + (target - v) * t)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${ch(0)}${ch(2)}${ch(4)}`;
}

/**
 * The welcome card's gradient, built from the current theme's own brand
 * gradient so it always belongs to the theme (peach on Black, red→amber on
 * Rose, charcoal on Paper). Text on it uses `colors.onAccent`.
 */
export function heroGradient(colors: ThemeColors): [string, string, string] {
  if (colors.hero) return colors.hero;
  const [a, b] = colors.gradient;
  return [b, a, shadeHex(a, -0.22)];
}

/** Home's header sits on the intro band: the colour at the band's top, and the text on it. */
export function introBand(colors: ThemeColors): { background: string; ink: string; isDark: boolean } {
  const background = heroGradient(colors)[0];
  const ink = colors.onHero ?? colors.onGradient;
  // Status-bar icons match the band's own text (white text → white icons), so they read on
  // every theme, including mid-tones like Starlight's pink where brightness alone misjudges.
  const h = ink.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  const isDark = h.length === 6 && 0.299 * r + 0.587 * g + 0.114 * b > 140;
  return { background, ink, isDark };
}

/** The text colour on the gradient at a given opacity, for badges and panels on it. */
function onAccentAlpha(colors: ThemeColors, alpha: number) {
  const h = (colors.onHero ?? colors.onGradient).replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function greeting(name?: string | null) {
  const h = new Date().getHours();
  const first = getFirstName(name);
  const salutation = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return first ? `${salutation}, ${first}` : salutation;
}

/** The streak badge is a white chip on every theme so the flame's colours read. */
const CHIP_BG = '#FFFFFF';

/**
 * Home's intro card, in the Play live card's style but in the theme's own
 * gradient: greeting, your space's name, the two of you with the streak badge
 * beside you, and this week's streak days. Tapping the badge or the week opens
 * Streak.
 */
export function WelcomeCard({
  user,
  partner,
  spaceName,
  status,
  joinedAt,
  band = false,
  onPressPartner,
}: {
  user: UserProfile | null;
  partner: UserProfile | null;
  spaceName: string | null | undefined;
  status: StreakStatus | null;
  joinedAt?: string | null;
  /**
   * Home: the card is the top of the page, like an album's cover: edge to edge, running up
   * under the header (which takes its colour), curved at the bottom.
   */
  band?: boolean;
  onPressPartner?: () => void;
}) {
  const { colors } = useTheme();
  const ink = colors.onHero ?? colors.onGradient;
  const sticker = !!colors.sticker;
  // Outlined themes with their own hero colour (Color) draw the hero and its parts as stickers.
  const outlined = !!colors.boldBorder && !!colors.hero;
  // Default / Violet: the week sits on a white sticker inside the hero.
  const soft = sticker ? STICKER_PANEL : onAccentAlpha(colors, 0.16);
  const gradient = heroGradient(colors);
  const ring = sticker ? ink : colors.gradient[0];
  // On the white week panel and white avatars the text is always ink, whatever the hero's text colour.
  const panelInk = sticker ? PANEL_INK : ink;
  const initial = sticker ? PANEL_INK : undefined;
  const paired = !!partner;

  const week = useMemo(() => (status ? buildStreakWeek(status, joinedAt) : []), [status, joinedAt]);
  const count = status?.current_streak ?? 0;
  const atRisk = !!status && count > 0 && isStreakVisuallyAtRisk(status);

  const openStreak = () => {
    void Haptics.selectionAsync();
    router.navigate('/streak');
  };

  const card = (
    <LinearGradient
      colors={gradient}
      // As a band the colour runs top to bottom, so its top edge meets the header seamlessly.
      start={{ x: 0, y: 0 }}
      end={band ? { x: 0, y: 1 } : { x: 1, y: 1 }}
      style={[
        styles.card,
        band && styles.bandCard,
        outlined && (band ? styles.bandOutline : { borderWidth: 3 }),
        outlined && { borderColor: colors.border },
      ]}>
      <Text style={[styles.greeting, { color: ink }]} numberOfLines={1}>
        {greeting(user?.name)}
      </Text>

      <Text style={[styles.title, { color: ink }]} numberOfLines={2}>
        {spaceName?.trim() || 'Our space'}
      </Text>


      <View style={styles.couple}>
        <View style={styles.avatars}>
          <View style={[styles.avatarRing, { borderColor: ring }]}>
            <Avatar name={user?.name} imageUrl={user?.avatar_url} size={38} colorsOverride={WHITE} initialColor={initial} />
          </View>
          {paired ? (
            <Pressable
              onPress={onPressPartner}
              accessibilityRole="button"
              accessibilityLabel={`View ${partner?.name ?? 'partner'} profile`}
              style={[styles.avatarRing, styles.overlap, { borderColor: ring }]}>
              <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={38} colorsOverride={WHITE} initialColor={initial} />
            </Pressable>
          ) : (
            <View style={[styles.emptyAvatar, styles.overlap]}>
              <DashedRing size={44} color={onAccentAlpha(colors, 0.6)} />
              <Icon name="plus" size={18} color={ink} />
            </View>
          )}
        </View>
        {status ? (
          <Pressable
            onPress={openStreak}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={
              count > 0 ? (atRisk ? `${count} day streak, ends tonight` : `${count} day streak`) : 'Start a streak'
            }
            style={({ pressed }) => [styles.badge, pressed && styles.pressed]}>
            {/* Plain: the flame character and the number, straight on the card. */}
            <View style={count > 0 ? undefined : styles.idleFlame}>
              <StickerFlame size={40} face={count > 0} animated={count > 0} />
            </View>
            <Text style={[styles.badgeCount, { color: ink }]} numberOfLines={1}>
              {count}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {week.length > 0 ? (
        <Pressable
          onPress={openStreak}
          accessibilityRole="button"
          accessibilityLabel="This week's streak"
          style={({ pressed }) => [
            styles.weekPanel,
            { backgroundColor: soft },
            outlined && { borderWidth: 2, borderColor: ink },
            pressed && styles.pressed,
          ]}>
          <View style={styles.weekDays}>
            {week.map((d) => (
              <WeekDay
                key={d.date.toISOString()}
                day={d}
                ink={panelInk}
                faint={sticker ? 'rgba(26,26,26,0.35)' : onAccentAlpha(colors, 0.35)}
              />
            ))}
          </View>
        </Pressable>
      ) : null}
    </LinearGradient>
  );

  if (!band) return card;
  return (
    <View style={styles.bandWrap}>
      {/* Fills the space above when you pull to refresh, so the band never shows a gap. */}
      <View pointerEvents="none" style={[styles.bandBleed, { backgroundColor: gradient[0] }]} />
      {card}
    </View>
  );
}

/** A day on the intro card's week: lit flame when you both showed up, a ring for today (red if the streak ends tonight). */
function WeekDay({ day, ink, faint }: { day: StreakDayCell; ink: string; faint: string }) {
  const done = day.state === 'completed' || day.state === 'today-done';
  const risky = day.state === 'today-at-risk';
  const today = day.isToday;
  return (
    <View style={styles.weekDay}>
      <Text style={[styles.weekLetter, { color: ink, opacity: today ? 1 : 0.75 }]}>{day.weekdayLabel.charAt(0)}</Text>
      <View
        style={[
          styles.dayCircle,
          // Lit days look like the milestone screen: yellow, bold ink outline, sticker flame.
          done
            ? { backgroundColor: STICKER_LIT, borderColor: '#000000', borderWidth: 2 }
            : risky
              ? { backgroundColor: CHIP_BG, borderColor: STREAK_COLORS.atRisk, borderWidth: 2 }
              : today
                ? { borderColor: ink }
                : { borderColor: 'transparent' },
        ]}>
        {!done && !risky && !today ? <DashedRing size={30} color={faint} /> : null}
        {done ? (
          <StickerFlame size={16} />
        ) : risky ? (
          <StickerFlame size={14} />
        ) : today ? (
          <View style={[styles.todayDot, { backgroundColor: ink }]} />
        ) : null}
      </View>
    </View>
  );
}

/** Photo-less avatars are white with a coloured initial, so they stand out on the card (as in the first design). */
const WHITE: [string, string] = ['#FFFFFF', '#FFFFFF'];

/** A lit day, as on the milestone celebration. */
const STICKER_LIT = '#FFE7A0';
/** Text on that white panel and on the white avatars. */
const PANEL_INK = '#1A1A1A';
/** A white sticker inside the hero (white in dark mode too, as its text is ink). */
const STICKER_PANEL = '#FFFFFF';

const styles = StyleSheet.create({
  idleFlame: { opacity: 0.45 },
  card: { borderRadius: 28, padding: 20, gap: 6, overflow: 'hidden' },
  bandWrap: { marginHorizontal: -Spacing.lg, marginTop: -Spacing.xs },
  bandBleed: { position: 'absolute', left: 0, right: 0, top: -600, height: 600 },
  bandCard: {
    borderRadius: 0,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 24,
  },
  bandOutline: { borderBottomWidth: 3, borderLeftWidth: 0, borderRightWidth: 0, borderTopWidth: 0 },
  glow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    right: -80,
    top: -110,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  greeting: { fontSize: 14, fontWeight: '700', opacity: 0.88 },
  // The streak, plain on the card: flame and number side by side.
  badge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  badgeCount: { fontSize: 44, fontWeight: '900', letterSpacing: -1.5, lineHeight: 48 },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.7, lineHeight: 35 },
  couple: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarRing: { borderWidth: 3, borderRadius: 25 },
  overlap: { marginLeft: -12 },
  emptyAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  weekPanel: { marginTop: 14, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 10, gap: 10 },
  weekDays: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay: { alignItems: 'center', gap: 6, flex: 1 },
  weekLetter: { fontSize: 11, fontWeight: '800' },
  dayCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayDot: { width: 8, height: 8, borderRadius: 4 },
});
