import { useEffect, useRef } from 'react';

import { TRIAL_DAYS } from '@/constants/subscription';
import { useSubscription } from '@/hooks/useSubscription';
import { isOnboardingPaywallDone } from '@/lib/onboarding-storage';
import {
  hasShownPartnerJoinedPaywall,
  markPartnerJoinedPaywallShown,
  markWinbackShown,
  shouldShowEntryPaywall,
  shouldShowWinback,
} from '@/lib/paywall-storage';
import { usePurchasesStore } from '@/lib/purchases';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';

/** Streaks at or above this get a "keep it safe" paywall after their celebration. */
const MILESTONE_PAYWALL_FROM = 7;
const OPEN_DELAY_MS = 1200;

/**
 * The paywall's timed moments (the free limits open it themselves through `requirePlus`):
 * 1. Your partner joins: "Start your free week together", once per couple, for the one who invited.
 * 2. After a streak milestone (7+ days) has been celebrated: keep it safe with Plus.
 * 3. Home, at most once a week: the reminder.
 * 4. Three days after the first close: the one time win back offer (only if that offering exists).
 * Never on Plus, never over another paywall, at most one per app session.
 */
export function PaywallMoments() {
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const { isPlus } = useSubscription();
  const openPaywall = useUIStore((s) => s.openPaywall);
  const showPaywall = useUIStore((s) => s.showPaywall);
  const milestone = useUIStore((s) => s.streakMilestoneCount);
  const shownThisSession = useUIStore((s) => s.paywallShownThisSession);
  const markShownThisSession = useUIStore((s) => s.markPaywallShownThisSession);
  const winbackPrice = usePurchasesStore((s) => s.winbackPrice);
  const lastMilestone = useRef<number | null>(null);

  const active = !!user && !!relationship && relationship.status !== 'ended' && !isPlus;

  // 1 · Partner joined.
  const partnerId = relationship?.user_2_id ?? null;
  const isInviter = !!user && relationship?.user_1_id === user.id;
  useEffect(() => {
    if (!active || !partnerId || !isInviter || showPaywall || !relationship || !user) return;
    const relId = relationship.id;
    let cancelled = false;
    void (async () => {
      if (!(await isOnboardingPaywallDone(user.id))) return; // onboarding shows its own
      if (await hasShownPartnerJoinedPaywall(relId)) return;
      if (cancelled) return;
      await markPartnerJoinedPaywallShown(relId);
      markShownThisSession();
      openPaywall(undefined, { headline: `You’re together! Start ${TRIAL_DAYS} days free` });
    })();
    return () => {
      cancelled = true;
    };
    // Only when the partner arrives (or the couple first loads with one).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, partnerId, isInviter]);

  // 2 · After a streak milestone's celebration closes.
  useEffect(() => {
    if (milestone != null) {
      lastMilestone.current = milestone;
      return;
    }
    const count = lastMilestone.current;
    lastMilestone.current = null;
    if (!active || count == null || count < MILESTONE_PAYWALL_FROM || showPaywall) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void shouldShowEntryPaywall().then((ok) => {
        if (cancelled || !ok) return;
        markShownThisSession();
        openPaywall('Streak restore', { headline: `${count} days in a row! Keep it safe with Plus` });
      });
    }, OPEN_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [milestone]);

  // 3 + 4 · The weekly Home reminder, or the one time win back offer in its place.
  useEffect(() => {
    if (!active || shownThisSession || showPaywall || !user) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        if (!(await isOnboardingPaywallDone(user.id))) return;
        if (winbackPrice && (await shouldShowWinback())) {
          if (cancelled) return;
          await markWinbackShown();
          markShownThisSession();
          openPaywall(undefined, { offer: 'winback' });
          return;
        }
        if (!(await shouldShowEntryPaywall()) || cancelled) return;
        markShownThisSession();
        openPaywall();
      })();
    }, OPEN_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // Once per session, when the app is ready (the win back price may load a moment later).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, winbackPrice]);

  return null;
}
