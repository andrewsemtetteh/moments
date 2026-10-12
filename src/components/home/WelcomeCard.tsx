import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StreakFlame } from '@/components/home/StreakFlame';
import { Icon } from '@/components/ui/Icon';
import { DashedRing } from '@/components/ui/DashedRing';
import { Avatar } from '@/components/ui/primitives';
import type { ThemeColors } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { streakSubtitle } from '@/lib/streak';
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
  const [a, b] = colors.gradient;
  return [b, a, shadeHex(a, -0.22)];
}

/** onAccent at a given opacity, for badges and panels on the gradient. */
function onAccentAlpha(colors: ThemeColors, alpha: number) {
  const h = colors.onAccent.replace('#', '');
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
const CHIP_TEXT = '#1A1008';

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
  onPressPartner,
}: {
  user: UserProfile | null;
  partner: UserProfile | null;
  spaceName: string | null | undefined;
  status: StreakStatus | null;
  joinedAt?: string | null;
  onPressPartner?: () => void;
}) {
  const { colors } = useTheme();
  const ink = colors.onAccent;
  const soft = onAccentAlpha(colors, 0.16);
  const gradient = heroGradient(colors);
  const ring = colors.gradient[0];
  const paired = !!partner;

  const week = useMemo(() => (status ? buildStreakWeek(status, joinedAt) : []), [status, joinedAt]);
  const count = status?.current_streak ?? 0;
  const atRisk = !!status && count > 0 && isStreakVisuallyAtRisk(status);

  const openStreak = () => {
    void Haptics.selectionAsync();
    router.navigate('/streak');
  };

  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      {/* <View pointerEvents="none" style={styles.glow} /> */}

      <Text style={[styles.greeting, { color: ink }]} numberOfLines={1}>
        {greeting(user?.name)}
      </Text>

      <Text style={[styles.title, { color: ink }]} numberOfLines={2}>
        {spaceName?.trim() || 'Our space'}
      </Text>

      <View style={styles.couple}>
        <View style={styles.avatars}>
          <View style={[styles.avatarRing, { borderColor: ring }]}>
            <Avatar name={user?.name} imageUrl={user?.avatar_url} size={38} colorsOverride={WHITE} />
          </View>
          {paired ? (
            <Pressable
              onPress={onPressPartner}
              accessibilityRole="button"
              accessibilityLabel={`View ${partner?.name ?? 'partner'} profile`}
              style={[styles.avatarRing, styles.overlap, { borderColor: ring }]}>
              <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={38} colorsOverride={WHITE} />
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
            style={({ pressed }) => [styles.badge, { backgroundColor: CHIP_BG }, pressed && styles.pressed]}>
            {count > 0 ? (
              <>
                {/* Lit: the flame glows in the streak colour (red when it ends tonight). */}
                <View
                  style={[
                    styles.flameGlow,
                    atRisk
                      ? { backgroundColor: STREAK_COLORS.atRiskSoftLight, shadowColor: STREAK_COLORS.atRisk }
                      : { backgroundColor: STREAK_COLORS.activeFillLight, shadowColor: STREAK_COLORS.active },
                  ]}>
                  <StreakFlame size={18} tone={atRisk ? 'risk' : 'active'} effect={atRisk ? 'pulse' : 'flicker'} />
                </View>
                <Text style={[styles.badgeCount, { color: atRisk ? STREAK_COLORS.atRisk : STREAK_COLORS.active }]}>
                  {count}
                </Text>
                {atRisk ? <Text style={[styles.badgeText, { color: STREAK_COLORS.atRisk }]}>Ends tonight</Text> : null}
              </>
            ) : (
              <>
                <StreakFlame size={16} tone="idle" />
                <Text style={[styles.badgeText, { color: CHIP_TEXT }]}>Start a streak</Text>
              </>
            )}
          </Pressable>
        ) : null}
      </View>

      {week.length > 0 ? (
        <Pressable
          onPress={openStreak}
          accessibilityRole="button"
          accessibilityLabel="This week's streak"
          style={({ pressed }) => [styles.weekPanel, { backgroundColor: soft }, pressed && styles.pressed]}>
          <View style={styles.weekDays}>
            {week.map((d) => (
              <WeekDay key={d.date.toISOString()} day={d} ink={ink} faint={onAccentAlpha(colors, 0.35)} />
            ))}
          </View>
          {paired && count === 0 && status ? (
            <Text style={[styles.hint, { color: ink }]} numberOfLines={2}>
              {streakSubtitle(status)}
            </Text>
          ) : null}
        </Pressable>
      ) : null}
    </LinearGradient>
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
          done
            ? { backgroundColor: CHIP_BG, borderColor: CHIP_BG }
            : risky
              ? { backgroundColor: CHIP_BG, borderColor: STREAK_COLORS.atRisk }
              : today
                ? { borderColor: ink }
                : { borderColor: 'transparent' },
        ]}>
        {!done && !risky && !today ? <DashedRing size={30} color={faint} /> : null}
        {done ? (
          <StreakFlame size={18} tone="active" />
        ) : risky ? (
          <StreakFlame size={16} tone="risk" />
        ) : today ? (
          <View style={[styles.todayDot, { backgroundColor: ink }]} />
        ) : null}
      </View>
    </View>
  );
}

/** Photo-less avatars are white with a coloured initial, so they stand out on the card (as in the first design). */
const WHITE: [string, string] = ['#FFFFFF', '#FFFFFF'];

const styles = StyleSheet.create({
  card: { borderRadius: 28, padding: 20, gap: 6, overflow: 'hidden' },
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
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 36, paddingHorizontal: 14, borderRadius: 18 },
  badgeCount: { fontSize: 16, fontWeight: '900', letterSpacing: -0.3 },
  // Soft halo behind a lit flame; iOS adds a coloured glow on top.
  flameGlow: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  badgeText: { fontSize: 13, fontWeight: '800' },
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
  hint: { fontSize: 13, fontWeight: '700', textAlign: 'center', opacity: 0.9 },
});
