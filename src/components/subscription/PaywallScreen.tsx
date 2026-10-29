import * as Haptics from '@/lib/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// import { CoupleCharacters, FloatingArt } from '@/components/onboarding/Characters';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar, colorWithAlpha, separatorColor } from '@/components/ui/primitives';
import {
  BILLING_CONNECTED,
  DEFAULT_PLAN,
  formatUsd,
  planById,
  SUBSCRIPTION_PLANS,
  TRIAL_DAYS,
  TRIAL_REMINDER_DAY,
  type SubscriptionPlan,
  type SubscriptionPlanId,
  REFERRAL_DAYS,
  PER_WEEK_USD,
  YEARLY_SAVING_PERCENT,
} from '@/constants/subscription';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { purchasePlan, restorePlus, usePurchasesStore, WINBACK_OFFER } from '@/lib/purchases';
import { PaywallDetour, type PaywallDetourPage } from '@/components/subscription/PaywallDetour';
import { AnalyticsEvents, trackForCouple } from '@/services/analytics';
import { getFlagVariant } from '@/lib/product-analytics';
import { claimNotificationKey, sendPartnerNotification } from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';

const INK = '#1A1A1A';

/** True for light colours like #FFFFFF (so text on the banner is light). */
function isLightColor(hex: string) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return true;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150;
}

/** The first three show (two on short phones); the rest sit behind "See all", so the plans stay in view. */
const PERKS_SHOWN = 3;
const PERKS_SHOWN_SHORT = 2;
/** The verified badge before each feature, and the space after it ("See all" lines up past both). */
const PERK_ICON = 18;
const PERK_GAP = 10;
/** The feature card's inner padding (left and right). */
const PERK_INSET = 14;
/** Below this window height (iPhone SE / mini class) only two features show before the plans. */
const SHORT_SCREEN_H = 740;

/**
 * PostHog experiment: features before the plans ("control") or the plans first
 * ("prices-first"). Every paywall event carries which one was shown (`layout`).
 */
const ORDER_FLAG = 'paywall-order';
/**
 * Everything Moments Plus unlocks, most important first. The top three are what makes a couple
 * pay: the AI games and conversations nobody else has, the limit they run into most (moments),
 * and live game nights together. "One plan, both of you" is last: the headline
 * already says it. Only what the app really gates: promising something free users already have backfires.
 */
const PERKS: { title: string }[] = [
  // Was 'Unlimited games and conversations made for you two' (kept to bring back).
  { title: 'Unlimited games & conversations' /* + ' made for you two' */ },
  { title: 'Share unlimited moments every day' },
  { title: 'Live game nights with voice chat' },
  { title: 'Create as many albums as you like' },
  { title: 'Pick your own app icon' },
  { title: 'Restore a broken streak the day it ends' },
  { title: 'See your whole history of moments' },
  { title: 'One plan covers both of you' },
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
  /** "Not ready? Get 14 days free" (invite a couple). On by default; it opens over the paywall. */
  showRefer?: boolean;
  /** Terms / Privacy links (required on a subscription screen). They open over the paywall. */
  showLegal?: boolean;
  /** Swipe down to close (the in-app overlay). Off on the sign-up step, which has nothing behind it. */
  /** @deprecated The paywall is never draggable now; kept so existing callers still compile. */
  swipeToClose?: boolean;
};

/**
 * Moments Plus. Hybrid model: the core app is free; this shows at the end of onboarding, when the
 * partner joins, at each free limit and at milestones. One plan covers both partners.
 *
 * Plans: yearly (selected), monthly, weekly. Yearly and weekly start with a free trial; monthly
 * starts today. Each card leads with its weekly rate, with the billed price spelled out beside it. Prices come from the
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
  showRefer = true,
  showLegal = true,
}: Props) {
  // Read live, so a fold / unfold, split screen or rotation redraws at the new size.
  const SCREEN_H = useWindowDimensions().height;
  const perksShown = SCREEN_H < SHORT_SCREEN_H ? PERKS_SHOWN_SHORT : PERKS_SHOWN;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const winbackPrice = usePurchasesStore((s) => s.winbackPrice);
  // The win back offer: one yearly card at the discounted first year price.
  const winback = offer === 'winback' && !!winbackPrice;
  // Decided once per open, so the page never rearranges under them. The win back offer is for
  // people who already know Plus: its price leads.
  const [pricesFirst] = useState(() => winback || getFlagVariant(ORDER_FLAG) === 'prices-first');
  const layout = pricesFirst ? 'prices_first' : 'features_first';
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanId>(winback ? 'yearly' : DEFAULT_PLAN);
  const [loading, setLoading] = useState(false);
  const [allPerks, setAllPerks] = useState(false);
  const storePrices = usePurchasesStore((s) => s.prices);
  const storePerWeek = usePurchasesStore((s) => s.perWeek);
  // Yearly vs the full weekly price all year: the store's prices once loaded, ours until then.
  const yearlySaving = usePurchasesStore((s) => s.yearlySaving) ?? YEARLY_SAVING_PERCENT;
  const me = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const relationship = useRelationshipStore((s) => s.relationship);
  const them = getFirstName(partner?.name);
  // Terms, Privacy or invite-a-couple, slid in over the paywall.
  const [detour, setDetour] = useState<PaywallDetourPage | null>(null);
  // "Send to Sam": idle, sending, then sent (once per open).
  const [suggest, setSuggest] = useState<'idle' | 'sending' | 'sent'>('idle');
  // Apple and Google give one introductory offer per person; after that, plans start at full price.
  const trialEligible = usePurchasesStore((s) => s.trialEligible);
  const storeIntroPrices = usePurchasesStore((s) => s.introPrices);
  const plan = planById(selectedPlan);
  const introOf = (p: SubscriptionPlan) => (!winback && trialEligible ? p.intro : null);
  const intro = introOf(plan);
  // Free days (yearly) vs a cheap first period (weekly's $0.99 first week).
  const hasTrial = intro?.kind === 'free';
  const introPriceOf = (p: SubscriptionPlan) => {
    const i = introOf(p);
    return i?.kind === 'paid' ? (storeIntroPrices[p.id] ?? formatUsd(i.priceUsd)) : null;
  };
  const introPrice = introPriceOf(plan);
  const introSpan = (days: number) => (days === 7 ? 'week' : `${days} days`);
  const shownPlans = winback ? SUBSCRIPTION_PLANS.filter((p) => p.id === 'yearly') : SUBSCRIPTION_PLANS;
  const priceOf = (id: SubscriptionPlanId) => storePrices[id] ?? formatUsd(planById(id).priceUsd);
  // Every plan as a weekly rate ("$1.35" a week on yearly), in their own currency.
  const perWeekOf = (id: SubscriptionPlanId) => storePerWeek[id] ?? formatUsd(PER_WEEK_USD[id]);
  // "Try 7 days for $0.00": free, said as a price, in their own currency. The real
  // price sits right under it in the pinned footer.
  const zeroPrice = usePurchasesStore((s) => s.zeroPrice) ?? '$0.00';
  const cta = winback
    ? 'Claim my offer'
    : hasTrial
      ? `Try ${TRIAL_DAYS} days for ${zeroPrice}`
      : introPrice && intro
        ? `Try your first ${introSpan(intro.days)} for ${introPrice}`
        : 'Subscribe';
  // The pinned footer's height, so the end of the page scrolls clear of it.
  const [footerH, setFooterH] = useState(0);
  const fine = winback
    ? `${winbackPrice} for your first year, then ${priceOf('yearly')} a year for both of you.`
    : hasTrial
      ? `${TRIAL_DAYS} days free, then ${priceOf(plan.id)} ${plan.perWords} for both of you.`
      : introPrice && intro
        ? `${introPrice} for your first ${introSpan(intro.days)}, then ${priceOf(plan.id)} ${plan.perWords} for both of you.`
        : `${priceOf(plan.id)} ${plan.perWords} for both of you. Renews automatically.`;

  // Funnel: shown (and where).
  useEffect(() => {
    void trackForCouple(AnalyticsEvents.PAYWALL_VIEWED, { placement, reason: reason ?? null, layout });
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
          layout,
          offer: winback ? 'winback' : introPrice ? 'intro_price' : null,
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
      Alert.alert(
        'Can’t restore here',
        'This version of Moments can’t reach the App Store. Restore from the Moments app you installed from the store.',
      );
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

  // "Send to Sam": one of you often decides, so the other can pass it on. It
  // arrives as a notification that opens this same screen on their phone.
  const sendToPartner = async () => {
    if (!relationship || !partner || suggest !== 'idle') return;
    setSuggest('sending');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      // Once a day at most, however often the paywall opens: no nagging.
      const today = new Date().toISOString().slice(0, 10);
      if (!(await claimNotificationKey(relationship.id, `plus_suggest:${me?.id}:${today}`))) {
        setSuggest('sent');
        return;
      }
      const mine = getFirstName(me?.name) ?? 'Your person';
      await sendPartnerNotification(
        relationship.id,
        partner.id,
        'plus_suggest',
        `${mine} wants to try Moments Plus with you. ${TRIAL_DAYS} days free, one plan for both of you.`,
      );
      void trackForCouple(AnalyticsEvents.PAYWALL_SENT_TO_PARTNER, { placement });
      setSuggest('sent');
    } catch {
      setSuggest('idle');
      Alert.alert('Couldn’t send it', 'Check your connection and try again.');
    }
  };

  // Not draggable: it closes only from the close button (which slides it away).
  const translateY = useSharedValue(0);
  const scrollY = useSharedValue(0);
  const finish = () => {
    void trackForCouple(AnalyticsEvents.PAYWALL_CLOSED, { placement, layout });
    onClose?.();
  };
  const closeAnimated = () => {
    translateY.value = withTiming(SCREEN_H, { duration: 220 }, (done) => {
      if (done) runOnJS(finish)();
    });
  };

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

  // The features card's edge and separators: a faint ink, lighter than the usual separator
  // (and light on the outlined themes too, whose border colour is solid black).
  const perkLine = colorWithAlpha(colors.text, colors.isDark ? 0.12 : 0.07);

  // The features card and the plans: their order is the experiment above.
  const featuresCard = (
    <View style={[styles.perkCard, { backgroundColor: colors.surface, borderColor: perkLine }]}>
      {(allPerks ? PERKS : PERKS.slice(0, perksShown)).map((p) => (
        <View key={p.title} style={[styles.perk, { borderBottomColor: perkLine }]}>
          <Icon name="verified" size={PERK_ICON} color={colors.success} />
          <Text style={[styles.perkText, { color: colors.text }]}>{p.title}</Text>
        </View>
      ))}
      <Pressable
        onPress={() => {
          void Haptics.selectionAsync();
          setAllPerks((v) => !v);
        }}
        accessibilityRole="button"
        accessibilityState={{ expanded: allPerks }}
        style={({ pressed }) => [styles.morePerks, pressed && styles.pressed]}>
        <Text style={[styles.morePerksText, { color: colors.text }]}>
          {allPerks ? 'Show less' : `See all ${PERKS.length} Plus features`}
        </Text>
        <View style={allPerks ? styles.flipped : undefined}>
          <Icon name="chevronDown" size={15} color={colors.text} />
        </View>
      </Pressable>
    </View>
  );

  const plansBlock = (
    <View style={styles.plans} accessibilityRole="radiogroup">
      {shownPlans.map((p) => {
        const on = p.id === selectedPlan;
        const yearly = p.id === 'yearly';
        const trial = introOf(p)?.kind === 'free';
        const pIntro = introOf(p);
        const pIntroPrice = introPriceOf(p);
        // Corner badge: only the plan we recommend (or the one-time offer).
        const badge = winback
          ? 'One-time offer'
          : yearly
            ? `Best value · Save ${yearlySaving}%`
            : null;
        const monthly = p.id === 'monthly';
        // Yearly and weekly read as a weekly rate; monthly keeps its monthly price (and the win
        // back offer its first-year price).
        const period = winback || monthly ? p.per : '/week';
        return (
            <Pressable
              key={p.id}
              onPress={() => {
                void Haptics.selectionAsync();
                setSelectedPlan(p.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={({ pressed }) => [
                styles.plan,
                {
                  // Selected: the accent outline and a light accent wash.
                  backgroundColor: on
                    ? colorWithAlpha(colors.accent, colors.isDark ? 0.16 : 0.07)
                    : colors.surface,
                  borderColor: on ? colors.accent : colors.border,
                  borderWidth: on ? 2.5 : 1.5,
                },
                pressed && styles.pressed,
              ]}>
              {badge ? (
                <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.badgeText, { color: colors.onAccent }]}>{badge}</Text>
                </View>
              ) : null}
              {/* Check: filled when chosen. */}
              <View
                style={[
                  styles.radio,
                  on
                    ? { backgroundColor: colors.accent, borderColor: colors.accent }
                    : { borderColor: colors.border },
                ]}>
                {on ? <Icon name="check" size={14} color={colors.onAccent} /> : null}
              </View>
              {/* Top line: the plan and its price. Under it, on its own line: how it starts. */}
              <View style={styles.planInfo}>
                <View style={styles.planTop}>
                  <Text style={[styles.planName, { color: colors.text }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  {/* "$1.35/week": the period smaller, on the price's baseline. What's actually
                      billed is in the line below and under the button. */}
                  <Text style={[styles.price, { color: colors.text }]} numberOfLines={1}>
                    {winback ? winbackPrice : monthly ? priceOf(p.id) : perWeekOf(p.id)}
                    <Text style={[styles.per, { color: colors.textSecondary }]}>{period}</Text>
                  </Text>
                </View>
                {/* Always one line: shrinks a touch on narrow phones rather than wrapping. */}
                <Text
                  style={[styles.planSub, { color: colors.textSecondary }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}>
                  {winback
                    ? `Your first year, then ${priceOf('yearly')} a year`
                    : yearly
                      ? // Yearly: what you're billed, in words, under the weekly rate.
                        trial
                        ? `${TRIAL_DAYS} days free, then ${priceOf('yearly')} a year`
                        : `${priceOf('yearly')} billed once a year`
                      : trial
                        ? `${TRIAL_DAYS} days free, then ${priceOf(p.id)} ${p.perWords}`
                        : pIntroPrice && pIntro
                          ? `${pIntroPrice} your first ${introSpan(pIntro.days)}, then ${priceOf(p.id)} ${p.perWords}`
                          : monthly
                            ? 'Starts today, billed monthly'
                            : `Starts today, ${priceOf(p.id)} ${p.perWords}`}
                  </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
  );

  return (
    <View style={styles.root}>
      <Animated.View style={[styles.root, { backgroundColor: colors.background }, pageStyle]}>
        {/* Match the status bar text to whatever is behind it: banner or page. */}
        <StatusBar style={pastHero ? pageBarStyle : heroBarStyle} />
        <Animated.ScrollView
          showsVerticalScrollIndicator={false}
          bounces={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
          contentContainerStyle={{ paddingBottom: footerH + 16 }}>
          <LinearGradient
            colors={colors.gradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            onLayout={(e) => {
              heroBottom.set(e.nativeEvent.layout.y + e.nativeEvent.layout.height);
            }}
            style={[styles.hero, { paddingTop: insets.top + 8 }]}>
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
            {/* The two of you, hidden for now (kept to bring back easily):
            <View style={styles.couple}>
              <View style={[styles.coupleRing, { borderColor: colors.onAccent }]}>
                <Avatar name={me?.name} imageUrl={me?.avatar_url} size={52} />
              </View>
              <View style={[styles.coupleRing, styles.coupleSecond, { borderColor: colors.onAccent }]}>
                {partner ? (
                  <Avatar name={partner.name} imageUrl={partner.avatar_url} size={52} />
                ) : (
                  <View style={[styles.couplePlaceholder, { backgroundColor: colorWithAlpha(colors.onAccent, 0.22) }]}>
                    <Icon name="heart" size={22} color={colors.onAccent} />
                  </View>
                )}
              </View>
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
              {them
                ? `One plan covers you and ${them}.`
                : 'One plan covers you and your person.'}
            </Text>
          </LinearGradient>

          <View style={styles.body}>
            {pricesFirst ? (
              <>
                {plansBlock}
                {featuresCard}
              </>
            ) : (
              <>
                {featuresCard}
                {plansBlock}
              </>
            )}

            {partner && relationship && !winback ? (
              <Pressable
                onPress={() => void sendToPartner()}
                disabled={suggest !== 'idle'}
                accessibilityRole="button"
                style={({ pressed }) => [styles.suggest, { borderColor: colors.text }, pressed && styles.pressed]}>
                <Avatar name={partner.name} imageUrl={partner.avatar_url} size={40} />
                <View style={styles.flex}>
                  <Text style={[styles.referTitle, { color: colors.text }]}>
                    {suggest === 'sent' ? `Sent to ${them ?? 'your person'}` : `Send it to ${them ?? 'your person'}`}
                  </Text>
                  <Text style={[styles.referSub, { color: colors.textSecondary }]}>
                    {suggest === 'sent'
                      ? 'They’ll get a notification that opens this page. Either of you can start it.'
                      : 'Decide together. Either of you can start it, and it unlocks for both.'}
                  </Text>
                </View>
                {suggest === 'sending' ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <Icon
                    name={suggest === 'sent' ? 'check' : 'send'}
                    size={18}
                    color={suggest === 'sent' ? colors.success : colors.text}
                  />
                )}
              </Pressable>
            ) : null}

            {showRefer ? (
              <View style={styles.orRow}>
                <View style={[styles.orLine, { backgroundColor: separatorColor(colors) }]} />
                <Text style={[styles.orText, { color: colors.textTertiary }]}>or</Text>
                <View style={[styles.orLine, { backgroundColor: separatorColor(colors) }]} />
              </View>
            ) : null}

            {showRefer ? (
              <Pressable
                onPress={() => setDetour('refer')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.refer, { borderColor: colors.text }, pressed && styles.pressed]}>
                <View style={[styles.referTile, { backgroundColor: '#FFE7A0' }]}>
                  <Icon name="gift" size={20} color={INK} />
                </View>
                <View style={styles.flex}>
                  <Text style={[styles.referTitle, { color: colors.text }]}>
                    Not ready? Get {REFERRAL_DAYS} days free
                  </Text>
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
              {showLegal ? (
                <>
                  <Pressable onPress={() => setDetour('terms')} hitSlop={8}>
                    <Text style={[styles.link, { color: colors.textSecondary }]}>Terms</Text>
                  </Pressable>
                  <Pressable onPress={() => setDetour('privacy')} hitSlop={8}>
                    <Text style={[styles.link, { color: colors.textSecondary }]}>Privacy</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          </View>
        </Animated.ScrollView>
        {/* Pinned to the bottom: the button and exactly what it costs are always in view. */}
        <View
          onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
          style={[
            styles.footer,
            {
              paddingBottom: insets.bottom + 10,
              backgroundColor: colors.background,
              borderTopColor: separatorColor(colors),
            },
          ]}>
          {/* With a free trial, nothing is charged today: say so right above the button. */}
          {hasTrial ? (
            <View style={styles.noPayment}>
              <Icon name="checkDone" size={16} color={colors.success} />
              <Text style={[styles.noPaymentText, { color: colors.text }]}>No payment due now</Text>
            </View>
          ) : null}
          <Pressable
            onPress={() => void handleSubscribe()}
            disabled={loading}
            accessibilityRole="button"
            accessibilityHint={fine}
            style={({ pressed }) => [styles.cta, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}>
            {loading ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={[styles.ctaText, { color: colors.onAccent }]} numberOfLines={1} adjustsFontSizeToFit>
                {cta}
              </Text>
            )}
          </Pressable>
          <Text style={[styles.fine, { color: colors.textSecondary }]}>{fine}</Text>
        </View>
        <Animated.View
          pointerEvents="none"
          style={[styles.statusCover, { height: insets.top, backgroundColor: colors.background }, statusCoverStyle]}
        />
      </Animated.View>
      {/* Terms, Privacy, invite a couple: over the paywall, never instead of it. */}
      {detour ? <PaywallDetour page={detour} onClose={() => setDetour(null)} /> : null}
    </View>
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
    marginTop: 30,
    marginBottom: 8,
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
  couple: { flexDirection: 'row', justifyContent: 'center', marginBottom: 8 },
  coupleRing: { borderWidth: 3, borderRadius: 32 },
  coupleSecond: { marginLeft: -14 },
  couplePlaceholder: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  suggest: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 2, borderRadius: 18, padding: 14 },
  heroTitle: { fontSize: 25, fontWeight: '900', letterSpacing: -0.5, marginTop: 6, textAlign: 'center' },
  heroSub: { fontSize: 15, fontWeight: '600', textAlign: 'center', marginTop: 4 },
  body: { paddingHorizontal: 20, paddingTop: 20, gap: 16 },
  card: { borderWidth: 2, borderRadius: 22, overflow: 'hidden' },
  // Same width as the plans below; a thin, light edge rather than the heavy ink one.
  perkCard: { borderWidth: 1, borderRadius: 20, overflow: 'hidden' },
  // Rows kept short (so the plans stay in view), with a light line under each.
  perk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: PERK_GAP,
    paddingHorizontal: PERK_INSET,
    paddingVertical: 9,
    borderBottomWidth: 1,
  },
  perkText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 18 },
  // Lined up with the feature text (past the badge).
  morePerks: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
    marginLeft: PERK_INSET + PERK_ICON + PERK_GAP,
    paddingVertical: 9,
  },
  morePerksText: { fontSize: 13, fontWeight: '600' },
  flipped: { transform: [{ rotate: '180deg' }] },
  // Only the first card (Yearly) wears a badge on its top edge (11 above it): the section gap
  // plus this clears it, with no extra room between the cards.
  plans: { gap: 10, marginTop: 4 },
  plan: {
    minHeight: 64,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  // The recommended plan's corner badge, sitting on the card's top edge at the right.
  badge: {
    position: 'absolute',
    top: -11,
    right: 14,
    height: 22,
    paddingHorizontal: 10,
    borderRadius: 11,
    justifyContent: 'center',
  },
  badgeText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.3, textTransform: 'uppercase' },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  planInfo: { flex: 1, minWidth: 0, gap: 3 },
  planTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 },
  planName: { flexShrink: 1, fontSize: 17, fontWeight: '900', letterSpacing: -0.2 },
  planSub: { fontSize: 13, fontWeight: '600' },
  price: { flexShrink: 0, fontSize: 20, fontWeight: '900', letterSpacing: -0.4, textAlign: 'right' },
  per: { fontSize: 13, fontWeight: '700', letterSpacing: 0 },
  timeline: { borderRadius: 20, padding: 16, gap: 12 },
  timelineTitle: { fontSize: 14, fontWeight: '900' },
  step: { flexDirection: 'row', alignItems: 'stretch', gap: 12 },
  rail: { alignItems: 'center', width: 28 },
  stepDot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  railLine: { width: 3, flex: 1, minHeight: 18, borderRadius: 2, marginVertical: 3, opacity: 0.5 },
  stepCopy: { paddingBottom: 12 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orLine: { flex: 1, height: 1 },
  orText: { fontSize: 13, fontWeight: '800' },
  stepDay: { fontSize: 14, fontWeight: '800' },
  stepText: { fontSize: 13, lineHeight: 18 },
  cta: { height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 17, fontWeight: '800' },
  fine: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
  noPayment: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  noPaymentText: { fontSize: 14, fontWeight: '800' },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 8,
    borderTopWidth: 1,
  },
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
