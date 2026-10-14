import * as Haptics from '@/lib/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// import { CoupleCharacters, FloatingArt } from '@/components/onboarding/Characters';
import { Icon, type IconName } from '@/components/ui/Icon';
import { colorWithAlpha } from '@/components/ui/primitives';
import { FREE_DAILY_MOMENTS, FREE_TIMELINE_MOMENTS } from '@/constants/design-system';
import {
  BILLING_CONNECTED,
  DEFAULT_PLAN,
  formatUsd,
  PER_WEEK_USD,
  planById,
  SUBSCRIPTION_PLANS,
  TRIAL_DAYS,
  TRIAL_REMINDER_DAY,
  type SubscriptionPlanId,
  REFERRAL_DAYS,
} from '@/constants/subscription';
import { useTheme } from '@/hooks/useTheme';
import { purchasePlan, restorePlus, usePurchasesStore, WINBACK_OFFER } from '@/lib/purchases';
import { AnalyticsEvents, trackForCouple } from '@/services/analytics';

const SCREEN_H = Dimensions.get('window').height;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 800;
const INK = '#1A1A1A';

/** True for light colours like #FFFFFF (so text on the banner is light). */
function isLightColor(hex: string) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return true;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

const PERKS: { icon: IconName; title: string; free: string; tint: string }[] = [
  { icon: 'camera', title: 'Unlimited moments', free: `Free: ${FREE_DAILY_MOMENTS} a day`, tint: '#FFD9CC' },
  { icon: 'cards', title: 'Every conversation deck', free: 'Free: a few to try', tint: '#DCEBFF' },
  { icon: 'time', title: 'Your whole history', free: `Free: last ${FREE_TIMELINE_MOMENTS} moments`, tint: '#D7F2E3' },
  { icon: 'albums', title: 'Albums, map and Wrapped', free: 'Plus only', tint: '#FFE7A0' },
  { icon: 'fire', title: 'Save a broken streak', free: 'Plus only', tint: '#FFD6DC' },
];

const TIMELINE: { day: string; text: string; icon: IconName }[] = [
  { day: 'Today', text: 'Plus unlocked for both of you', icon: 'lock' },
  { day: `Day ${TRIAL_REMINDER_DAY}`, text: 'We remind you the trial ends in 2 days', icon: 'bell' },
  { day: `Day ${TRIAL_DAYS}`, text: 'Your plan starts. Cancel before and pay nothing', icon: 'star' },
];

type Props = {
  onClose?: () => void;
  showClose?: boolean;
  /** Replaces buying (onboarding preview, or before billing is connected). */
  onSubscribe?: (planId: SubscriptionPlanId) => void | Promise<void>;
  /** After a successful purchase (defaults to onClose). */
  onPurchased?: () => void;
  /** The feature that opened it ("Unlimited moments"), shown as the headline. */
  reason?: string | null;
  /** A full headline, overriding the reason (e.g. "You're connected!"). */
  headline?: string | null;
  /** 'winback': the one time discounted first year (only when that offering exists). */
  offer?: 'winback' | null;
  /** Where it was shown, for analytics (onboarding, limit, partner_joined, milestone, reminder, winback). */
  placement?: string;
  /** "Not ready? Get 14 days free" (invite a couple). */
  onRefer?: () => void;
  /** Terms / Privacy links (required on a subscription screen). */
  onOpenLegal?: (doc: 'terms' | 'privacy') => void;
  /** Swipe down to close (the in-app overlay). Off on the sign-up step, which has nothing behind it. */
  swipeToClose?: boolean;
};

/**
 * Moments Plus. Hybrid model: the core app is free; this shows at the end of onboarding, when the
 * partner joins, at each free limit and at milestones. One plan covers both partners.
 *
 * Plans: weekly (selected), yearly, monthly. Weekly and yearly start with a free trial; monthly
 * starts today. Each card shows its billed price and what a week costs. Prices come from the
 * store (local currency) once Superwall loads them.
 */
export function PaywallScreen({
  onClose,
  showClose = true,
  onSubscribe,
  onPurchased,
  reason,
  headline,
  offer,
  placement = 'other',
  onRefer,
  onOpenLegal,
  swipeToClose = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const winbackPrice = usePurchasesStore((s) => s.winbackPrice);
  // The win back offer: one yearly card at the discounted first year price.
  const winback = offer === 'winback' && !!winbackPrice;
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>(winback ? 'yearly' : DEFAULT_PLAN);
  const [loading, setLoading] = useState(false);
  const storePrices = usePurchasesStore((s) => s.prices);
  const storePerWeek = usePurchasesStore((s) => s.perWeek);
  // Apple and Google give one free trial per person; after that, plans start straight away.
  const trialEligible = usePurchasesStore((s) => s.trialEligible);
  const plan = planById(selectedPlan);
  const hasTrial = !winback && plan.trial && trialEligible;
  const shownPlans = winback ? SUBSCRIPTION_PLANS.filter((p) => p.id === 'yearly') : SUBSCRIPTION_PLANS;
  const priceOf = (id: SubscriptionPlanId) => storePrices[id] ?? formatUsd(planById(id).priceUsd);
  const perWeekOf = (id: SubscriptionPlanId) => storePerWeek[id] ?? formatUsd(PER_WEEK_USD[id]);
  const cta = winback ? 'Claim my offer' : hasTrial ? `Start ${TRIAL_DAYS} days free` : 'Subscribe';
  const fine = winback
    ? `${winbackPrice} for your first year, then ${priceOf('yearly')} a year for both of you. Cancel any time.`
    : hasTrial
      ? `${TRIAL_DAYS} days free, then ${priceOf(plan.id)} ${plan.perWords} for both of you. Cancel any time before day ${TRIAL_DAYS}.`
      : `${priceOf(plan.id)} ${plan.perWords} for both of you. Renews automatically, cancel any time.`;

  // Funnel: shown (and where).
  useEffect(() => {
    void trackForCouple(AnalyticsEvents.PAYWALL_VIEWED, { placement, reason: reason ?? null });
    // Once per open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubscribe = async () => {
    setLoading(true);
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      if (onSubscribe) {
        await onSubscribe(selectedPlan);
        return;
      }
      if (!BILLING_CONNECTED) {
        Alert.alert('Coming soon', 'Moments Plus will be available soon.');
        return;
      }
      const { result, message } = await purchasePlan(selectedPlan, winback ? WINBACK_OFFER : undefined);
      if (result === 'purchased') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        void trackForCouple(hasTrial ? AnalyticsEvents.TRIAL_STARTED : AnalyticsEvents.PURCHASED, {
          plan: selectedPlan,
          placement,
          offer: winback ? 'winback' : null,
        });
        (onPurchased ?? onClose)?.();
      } else if (result === 'pending') {
        Alert.alert('Payment pending', message ?? 'Plus unlocks as soon as your payment is approved.');
        onClose?.();
      } else if (result !== 'cancelled') {
        Alert.alert('That didn’t go through', message ?? 'Nothing was charged. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!BILLING_CONNECTED) {
      Alert.alert('Restore purchase', 'Purchases will be available soon.');
      return;
    }
    try {
      if (await restorePlus()) {
        Alert.alert('Welcome back', 'Moments Plus is active again for both of you.');
        (onPurchased ?? onClose)?.();
      } else {
        Alert.alert('Nothing to restore', 'We couldn’t find a Moments Plus purchase on this account.');
      }
    } catch {
      Alert.alert('Couldn’t restore', 'Check your connection and try again.');
    }
  };

  // Swipe down to close, like Moments: the page follows your finger and
  // slides away. A drag that starts while the page is scrolled down only
  // scrolls it (decided once, on touch down).
  const canClose = !!(showClose && onClose && swipeToClose);
  const translateY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const dragsPage = useSharedValue(false);
  const native = useMemo(() => Gesture.Native(), []);
  const finish = () => {
    void trackForCouple(AnalyticsEvents.PAYWALL_CLOSED, { placement });
    onClose?.();
  };
  const slideAway = (velocity = 0) => {
    translateY.value = withTiming(SCREEN_H, { duration: Math.max(140, 220 - Math.abs(velocity) / 20) }, (done) => {
      if (done) runOnJS(finish)();
    });
  };
  const closeAnimated = () => (canClose ? slideAway(0) : onClose?.());

  const pan = Gesture.Pan()
    .enabled(canClose)
    .activeOffsetY([-8, 8])
    .failOffsetX([-14, 14])
    .simultaneousWithExternalGesture(native)
    .onBegin(() => {
      dragsPage.value = scrollY.value <= 0;
    })
    .onUpdate((e) => {
      if (!dragsPage.value) return;
      if (scrollY.value > 0 && translateY.value <= 0) {
        dragsPage.value = false;
        return;
      }
      translateY.value = Math.max(0, e.translationY);
    })
    .onEnd((e) => {
      if (
        dragsPage.value &&
        translateY.value > 0 &&
        (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY)
      ) {
        runOnJS(slideAway)(e.velocityY);
        return;
      }
      if (translateY.value !== 0) translateY.value = withSpring(0, { damping: 26, stiffness: 300 });
    });

  // Past the colored banner, the page's own color slides in behind the
  // status bar and its text flips to match, so the clock and battery stay
  // readable over the plans (and the banner look returns at the top).
  const heroBottom = useSharedValue(0);
  const [pastHero, setPastHero] = useState(false);
  const pastHeroSV = useSharedValue(false);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
    const past = heroBottom.value > 0 && e.contentOffset.y > heroBottom.value - insets.top - 4;
    if (past !== pastHeroSV.value) {
      pastHeroSV.value = past;
      runOnJS(setPastHero)(past);
    }
  });
  const statusCoverStyle = useAnimatedStyle(() => {
    const end = heroBottom.value - insets.top;
    return { opacity: end > 0 ? interpolate(scrollY.value, [end - 40, end], [0, 1], 'clamp') : 0 };
  });
  const heroBarStyle = isLightColor(colors.onAccent) ? 'light' : 'dark';
  const pageBarStyle = isLightColor(colors.background) ? 'dark' : 'light';
  const pageStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));
  const surface = { backgroundColor: colors.surface, borderColor: colors.text };

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.root, { backgroundColor: colors.background }, pageStyle]}>
        {/* Match the status bar text to whatever is behind it: banner or page. */}
        <StatusBar style={pastHero ? pageBarStyle : heroBarStyle} />
        <GestureDetector gesture={native}>
          <Animated.ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            scrollEventThrottle={16}
            onScroll={onScroll}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
            <LinearGradient
              colors={colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              onLayout={(e) => {
                heroBottom.set(e.nativeEvent.layout.y + e.nativeEvent.layout.height);
              }}
              style={[styles.hero, { paddingTop: insets.top + 18 }]}>
              {showClose && onClose ? (
                <Pressable
                  onPress={closeAnimated}
                  accessibilityLabel="Close"
                  hitSlop={8}
                  style={[
                    styles.closeBtn,
                    { top: insets.top + 8, backgroundColor: colorWithAlpha(colors.onAccent, 0.22) },
                  ]}>
                  <Icon name="close" size={20} color={colors.onAccent} />
                </Pressable>
              ) : null}
              {/* Notes sit in their own row under the close button. */}
              <View style={styles.stickyRow}>
                <Text style={[styles.sticky, styles.stickyLeft]}>more “us” time</Text>
                <Text style={[styles.sticky, styles.stickyRight]}>every deck unlocked</Text>
              </View>
              {/* Illustration, hidden for now (kept to bring back easily):
              <View style={styles.heroArt}>
                <FloatingArt>
                  <CoupleCharacters width={200} />
                </FloatingArt>
              </View>
              */}
              <Text style={[styles.heroTitle, { color: colors.onAccent }]} numberOfLines={1} adjustsFontSizeToFit>
                {headline ??
                  (winback
                    ? 'A gift for you two'
                    : reason
                      ? `Unlock ${reason.charAt(0).toLowerCase()}${reason.slice(1)}`
                      : 'Unlock Moments Plus')}
              </Text>
              <Text style={[styles.heroSub, { color: colorWithAlpha(colors.onAccent, 0.85) }]}>
                One plan for both of you. Your person joins free.
              </Text>
            </LinearGradient>

            <View style={styles.body}>
              <View style={[styles.card, surface]}>
                {PERKS.map((p, i) => (
                  <View
                    key={p.title}
                    style={[
                      styles.perk,
                      i < PERKS.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.border,
                      },
                    ]}>
                    <View style={[styles.perkTile, { backgroundColor: p.tint }]}>
                      <Icon name={p.icon} size={18} color={INK} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={[styles.perkTitle, { color: colors.text }]}>{p.title}</Text>
                      <Text style={[styles.perkFree, { color: colors.textSecondary }]}>{p.free}</Text>
                    </View>
                    <Icon name="check" size={18} color={colors.success} />
                  </View>
                ))}
              </View>

              <View style={styles.plans} accessibilityRole="radiogroup">
                {shownPlans.map((p) => {
                  const on = p.id === selectedPlan;
                  const badge = winback
                    ? 'One time offer'
                    : p.id === 'yearly'
                      ? p.badge
                      : p.trial && trialEligible
                        ? p.badge
                        : undefined;
                  const sub = winback
                    ? `Your first year, then ${priceOf('yearly')} a year`
                    : p.trial && trialEligible
                      ? `${TRIAL_DAYS} days free, then billed ${p.perWords}`
                      : `Billed ${p.perWords}`;
                  return (
                    <Pressable
                      key={p.id}
                      onPress={() => {
                        void Haptics.selectionAsync();
                        setSelectedPlan(p.id);
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      style={[
                        styles.plan,
                        {
                          backgroundColor: colors.surface,
                          borderColor: on ? colors.text : colors.border,
                          borderWidth: on ? 3 : 2,
                        },
                      ]}>
                      {badge ? (
                        <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                          <Text style={[styles.badgeText, { color: colors.onAccent }]}>{badge}</Text>
                        </View>
                      ) : null}
                      <View style={[styles.radio, { borderColor: colors.text }]}>
                        {on ? <View style={[styles.radioDot, { backgroundColor: colors.text }]} /> : null}
                      </View>
                      <View style={styles.flex}>
                        <Text style={[styles.planName, { color: colors.text }]}>{p.name}</Text>
                        <Text style={[styles.planSub, { color: colors.textSecondary }]}>{sub}</Text>
                      </View>
                      <View style={styles.priceCol}>
                        <Text style={[styles.price, { color: colors.text }]}>
                          {winback ? winbackPrice : priceOf(p.id)}
                          <Text style={[styles.per, { color: colors.textSecondary }]}>{p.per}</Text>
                        </Text>
                        {p.id !== 'weekly' && !winback ? (
                          <Text style={[styles.perWeek, { color: colors.textTertiary }]}>{perWeekOf(p.id)}/week</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                onPress={() => void handleSubscribe()}
                disabled={loading}
                accessibilityRole="button"
                style={({ pressed }) => [styles.cta, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}>
                {loading ? (
                  <ActivityIndicator color={colors.onAccent} />
                ) : (
                  <Text style={[styles.ctaText, { color: colors.onAccent }]}>{cta}</Text>
                )}
              </Pressable>
              <Text style={[styles.fine, { color: colors.textSecondary }]}>{fine}</Text>

              {onRefer ? (
                <View style={styles.orRow}>
                  <View style={[styles.orLine, { backgroundColor: colors.border }]} />
                  <Text style={[styles.orText, { color: colors.textTertiary }]}>or</Text>
                  <View style={[styles.orLine, { backgroundColor: colors.border }]} />
                </View>
              ) : null}

              {onRefer ? (
                <Pressable
                  onPress={onRefer}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.refer, { borderColor: colors.text }, pressed && styles.pressed]}>
                  <View style={[styles.referTile, { backgroundColor: '#FFE7A0' }]}>
                    <Icon name="gift" size={20} color={INK} />
                  </View>
                  <View style={styles.flex}>
                    <Text style={[styles.referTitle, { color: colors.text }]}>Not ready? Get {REFERRAL_DAYS} days free</Text>
                    <Text style={[styles.referSub, { color: colors.textSecondary }]}>
                      Invite another couple. When they join, you both get {REFERRAL_DAYS} days of Plus.
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={16} color={colors.textTertiary} />
                </Pressable>
              ) : null}

              {/* How the trial works: last, with a line joining the steps (not on the win back offer). */}
              {winback ? null : (
                <View
                  style={[
                    styles.timeline,
                    {
                      backgroundColor: colors.boldBorder ? colors.backgroundElevated : colors.surfaceElevated,
                      opacity: hasTrial ? 1 : 0.4,
                    },
                  ]}>
                  <Text style={[styles.timelineTitle, { color: colors.text }]}>How your free trial works</Text>
                  {TIMELINE.map((s, i) => (
                    <View key={s.day} style={styles.step}>
                      <View style={styles.rail}>
                        <View style={[styles.stepDot, { backgroundColor: colors.accent }]}>
                          <Icon name={s.icon} size={14} color={colors.onAccent} />
                        </View>
                        {i < TIMELINE.length - 1 ? (
                          <View style={[styles.railLine, { backgroundColor: colors.accent }]} />
                        ) : null}
                      </View>
                      <View style={[styles.flex, styles.stepCopy]}>
                        <Text style={[styles.stepDay, { color: colors.text }]}>{s.day}</Text>
                        <Text style={[styles.stepText, { color: colors.textSecondary }]}>{s.text}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.links}>
                <Pressable onPress={() => void handleRestore()} hitSlop={8}>
                  <Text style={[styles.link, { color: colors.textSecondary }]}>Restore purchase</Text>
                </Pressable>
                {onOpenLegal ? (
                  <>
                    <Pressable onPress={() => onOpenLegal('terms')} hitSlop={8}>
                      <Text style={[styles.link, { color: colors.textSecondary }]}>Terms</Text>
                    </Pressable>
                    <Pressable onPress={() => onOpenLegal('privacy')} hitSlop={8}>
                      <Text style={[styles.link, { color: colors.textSecondary }]}>Privacy</Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            </View>
          </Animated.ScrollView>
        </GestureDetector>
        <Animated.View
          pointerEvents="none"
          style={[styles.statusCover, { height: insets.top, backgroundColor: colors.background }, statusCoverStyle]}
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  statusCover: { position: 'absolute', top: 0, left: 0, right: 0 },
  flex: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.85 },
  hero: {
    paddingHorizontal: 22,
    paddingBottom: 26,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    alignItems: 'center',
    overflow: 'hidden',
  },
  closeBtn: {
    position: 'absolute',
    right: 18,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  stickyRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 40,
    marginBottom: 14,
    gap: 12,
  },
  sticky: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
    fontSize: 12,
    fontWeight: '800',
    color: INK,
    overflow: 'hidden',
  },
  stickyLeft: { backgroundColor: '#FFE7A0', transform: [{ rotate: '-6deg' }] },
  stickyRight: { backgroundColor: '#D8D1FF', transform: [{ rotate: '5deg' }], marginTop: 14 },
  heroArt: { marginTop: 4 },
  heroTitle: { fontSize: 25, fontWeight: '900', letterSpacing: -0.5, marginTop: 6, textAlign: 'center' },
  heroSub: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  body: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  card: { borderWidth: 2, borderRadius: 22, overflow: 'hidden' },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  perkTile: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  perkTitle: { fontSize: 15, fontWeight: '800' },
  perkFree: { fontSize: 12, marginTop: 1 },
  // Room for the badge that sits on each plan's top edge.
  plans: { gap: 20, marginTop: 10 },
  plan: {
    minHeight: 70,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingTop: 18,
    paddingBottom: 14,
  },
  badge: {
    position: 'absolute',
    top: -11,
    left: 14,
    height: 22,
    paddingHorizontal: 9,
    borderRadius: 11,
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '900' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 12, height: 12, borderRadius: 6 },
  planName: { fontSize: 16, fontWeight: '900' },
  planSub: { fontSize: 12, marginTop: 1 },
  priceCol: { alignItems: 'flex-end', flexShrink: 0 },
  price: { fontSize: 17, fontWeight: '900', textAlign: 'right' },
  per: { fontSize: 12, fontWeight: '700' },
  perWeek: { fontSize: 11, fontWeight: '700', marginTop: 1 },
  timeline: { borderRadius: 20, padding: 16, gap: 12 },
  timelineTitle: { fontSize: 14, fontWeight: '900' },
  step: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  rail: { alignItems: 'center', width: 28 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  railLine: { width: 3, flex: 1, minHeight: 18, borderRadius: 2, marginVertical: 3, opacity: 0.5 },
  stepCopy: { paddingBottom: 12 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orLine: { flex: 1, height: StyleSheet.hairlineWidth },
  orText: { fontSize: 13, fontWeight: '800' },
  stepDay: { fontSize: 14, fontWeight: '800' },
  stepText: { fontSize: 13, lineHeight: 18 },
  cta: { height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 17, fontWeight: '800' },
  fine: { fontSize: 12, textAlign: 'center', marginTop: -6, lineHeight: 17 },
  refer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderRadius: 18,
    padding: 14,
  },
  referTile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  referTitle: { fontSize: 15, fontWeight: '900' },
  referSub: { fontSize: 12, lineHeight: 17, marginTop: 1 },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 18, paddingVertical: 4 },
  link: { fontSize: 12, fontWeight: '700' },
});
