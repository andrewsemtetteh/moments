import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from '@/lib/haptics';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StickerCake } from '@/components/home/StickerCake';
import { BirthdayShareCard } from '@/components/share/BirthdayShareCard';
import { ShareCardModal } from '@/components/share/ShareCardModal';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { ThemedStatusBar } from '@/components/ui/ThemedStatusBar';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { birthdayDayLabel, daysUntilBirthday, nextBirthday, turningAge } from '@/lib/birthday';
import { openCalendar, openChat } from '@/lib/router';
import {
  type BirthdayCelebration,
  isFullScreenLayerOpen,
  useAuthStore,
  useRelationshipStore,
  useUIStore,
} from '@/stores';

const OPEN_DELAY_MS = 1500;
/** After the page has gone, so Chat, Plan or the camera opens on top of the app, not under it. */
const AFTER_CLOSE_MS = 380;

const seenKey = (relationshipId: string, c: BirthdayCelebration, year: number) =>
  `moments_birthday_seen:${relationshipId}:${c.kind}:${c.whose}:${year}`;

/**
 * Opens the birthday page once a year, on each of your phones:
 * - on your birthday ("Happy birthday, Ama")
 * - on your partner's birthday ("It's Kofi's birthday")
 * - the day before your partner's birthday (the reminder: "Kofi's birthday is tomorrow")
 * Waits while another celebration or full-screen layer is up.
 */
export function BirthdaySync() {
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const mine = useAuthStore((s) => s.user?.birthday);
  const theirs = useRelationshipStore((s) => s.partner?.birthday);
  const busy = useUIStore(isFullScreenLayerOpen);

  useEffect(() => {
    if (!relationshipId || busy) return;
    const due: BirthdayCelebration[] = [];
    if (daysUntilBirthday(mine) === 0) due.push({ kind: 'today', whose: 'me' });
    const partnerDays = daysUntilBirthday(theirs);
    if (partnerDays === 0) due.push({ kind: 'today', whose: 'partner' });
    if (partnerDays === 1) due.push({ kind: 'eve', whose: 'partner' });
    if (!due.length) return;

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const year = new Date().getFullYear();
        for (const c of due) {
          const key = seenKey(relationshipId, c, year);
          if (await AsyncStorage.getItem(key).catch(() => '1')) continue;
          if (cancelled) return;
          await AsyncStorage.setItem(key, '1').catch(() => undefined);
          useUIStore.setState({ birthdayCelebration: c });
          return; // one at a time; the next waits for this one to close
        }
      })();
    }, OPEN_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [relationshipId, mine, theirs, busy]);

  return null;
}

/** The birthday page, mounted with the app's other overlays at the root. */
export function BirthdayCelebrationModal() {
  const celebration = useUIStore((s) => s.birthdayCelebration);
  if (!celebration) return null;
  return (
    <BirthdayPage
      key={`${celebration.kind}-${celebration.whose}`}
      celebration={celebration}
      onClose={() => useUIStore.setState({ birthdayCelebration: null })}
    />
  );
}

export function BirthdayPage({ celebration, onClose }: { celebration: BirthdayCelebration; onClose: () => void }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const [sharing, setSharing] = useState(false);

  const { kind, whose } = celebration;
  const person = whose === 'me' ? user : partner;
  const name = getFirstName(person?.name) ?? (whose === 'me' ? 'you' : 'your person');
  const other = getFirstName(whose === 'me' ? partner?.name : user?.name) ?? 'your person';
  // The eve looks a day ahead: the age they turn tomorrow.
  const age = turningAge(person?.birthday);
  const next = nextBirthday(person?.birthday);

  // The cake pops in, then the candle keeps a gentle bob.
  const pop = useSharedValue(reduceMotion ? 1 : 0.2);
  const bob = useSharedValue(0);
  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduceMotion) return;
    pop.value = withDelay(
      120,
      withSequence(
        withTiming(1.14, { duration: 380, easing: Easing.out(Easing.cubic) }),
        withTiming(0.96, { duration: 170 }),
        withTiming(1, { duration: 160 }),
      ),
    );
    bob.value = withDelay(900, withRepeat(withTiming(-6, { duration: 1100, easing: Easing.inOut(Easing.sin) }), -1, true));
    // Plays once per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const cakeStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }, { translateY: bob.value }] }));
  const enter = (delay: number) => (reduceMotion ? undefined : FadeInUp.delay(delay).duration(400));

  /** Close, then go on (Chat, Plan, the camera) once the page has gone. */
  const closeThen = (then?: () => void) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    if (then) setTimeout(then, AFTER_CLOSE_MS);
  };

  const copy =
    kind === 'eve'
      ? {
          kicker: 'Tomorrow',
          title: `${name}’s birthday is tomorrow`,
          message: `${next ? birthdayDayLabel(next) : 'Tomorrow'}${age ? `. They turn ${age}` : ''}. There’s still time to plan something, or at least line up the first message of the day.`,
        }
      : whose === 'me'
        ? {
            kicker: 'Today',
            title: `Happy birthday, ${name}!`,
            message: `${age ? `${age} looks good on you. ` : ''}We’ve let ${other} know. Expect something sweet today.`,
          }
        : {
            kicker: 'Today',
            title: `It’s ${name}’s birthday!`,
            message: `${age ? `${name} turns ${age} today. ` : ''}Be the first to say it: send a moment or a message.`,
          };

  const primary =
    kind === 'eve'
      ? { label: 'Plan something', onPress: () => closeThen(() => openCalendar(next ? { dateISO: next.toISOString() } : undefined)) }
      : whose === 'partner'
        ? { label: 'Send a birthday moment', onPress: () => closeThen(() => useUIStore.getState().setShowMomentCreator(true)) }
        : { label: 'Thank you!', onPress: () => closeThen() };
  const secondary =
    kind === 'eve'
      ? { label: 'Got it', icon: null, onPress: () => closeThen() }
      : whose === 'partner'
        ? { label: 'Wish them in chat', icon: 'chat' as const, onPress: () => closeThen(() => openChat(`Happy birthday ${name}! 🎂`)) }
        : null;

  const insets = useSafeAreaInsets();
  return (
    <Modal visible animationType="fade" onRequestClose={() => closeThen()} statusBarTranslucent presentationStyle="fullScreen">
      <ThemedStatusBar />
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {/* Clear of the status bar and home bar: measured padding (a SafeAreaView inside a full-screen Modal can read 0 and put the ✕ on the status bar). */}
        <View style={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
          <Pressable
            onPress={() => closeThen()}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.close}>
            <Icon name="close" size={26} color={colors.text} />
          </Pressable>

          <View style={styles.main}>
            <Animated.View style={cakeStyle}>
              <StickerCake size={150} />
            </Animated.View>
            <Animated.View entering={enter(380)} style={[styles.avatarRing, { borderColor: colors.background }]}>
              <Avatar name={person?.name} imageUrl={person?.avatar_url} size={56} />
            </Animated.View>
            <Animated.View entering={enter(480)} style={[styles.kicker, { backgroundColor: colors.accentSoft }]}>
              <Icon name={kind === 'eve' ? 'calendar' : 'gift'} size={14} color={colors.accent} />
              <Text style={[styles.kickerText, { color: colors.accent }]}>{copy.kicker}</Text>
            </Animated.View>
            <Animated.Text entering={enter(560)} style={[styles.title, { color: colors.text }]} numberOfLines={2} adjustsFontSizeToFit>
              {copy.title}
            </Animated.Text>
            <Animated.Text entering={enter(680)} style={[styles.message, { color: colors.textSecondary }]}>
              {copy.message}
            </Animated.Text>
          </View>

          <Animated.View entering={enter(820)} style={styles.actions}>
            <Pressable
              onPress={primary.onPress}
              accessibilityRole="button"
              style={({ pressed }) => [styles.cta, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
              <Text style={[styles.ctaText, { color: colors.onAccent }]}>{primary.label}</Text>
            </Pressable>
            {secondary ? (
              <Pressable
                onPress={secondary.onPress}
                accessibilityRole="button"
                style={({ pressed }) => [styles.secondary, { borderColor: colors.text }, pressed && styles.pressed]}>
                {secondary.icon ? <Icon name={secondary.icon} size={18} color={colors.text} /> : null}
                <Text style={[styles.secondaryText, { color: colors.text }]}>{secondary.label}</Text>
              </Pressable>
            ) : null}
            {kind === 'today' ? (
              <Pressable
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSharing(true);
                }}
                accessibilityRole="button"
                hitSlop={6}
                style={({ pressed }) => [styles.share, pressed && styles.pressed]}>
                <Icon name="share" size={18} color={colors.text} />
                <Text style={[styles.shareText, { color: colors.text }]}>Share</Text>
              </Pressable>
            ) : null}
          </Animated.View>
        </View>

        {/* Inside this page, so it sits on top of it. */}
        <ShareCardModal visible={sharing} onClose={() => setSharing(false)} title="Share the birthday" inline>
          <BirthdayShareCard name={name} age={age} />
        </ShareCardModal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24 },
  close: { alignSelf: 'flex-end', width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  // Its own space under the cake (the candle bob never reaches it).
  avatarRing: { borderWidth: 4, borderRadius: 999, marginTop: 14 },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    height: 28,
    borderRadius: 14,
    marginTop: 6,
  },
  kickerText: { fontSize: 13, fontWeight: '900', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 32, fontWeight: '900', letterSpacing: -0.8, lineHeight: 37, textAlign: 'center' },
  message: { fontSize: 16, lineHeight: 23, textAlign: 'center' },
  actions: { gap: 10, paddingBottom: 8 },
  cta: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 17, fontWeight: '800' },
  secondary: {
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { fontSize: 17, fontWeight: '800' },
  share: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareText: { fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.8 },
});
