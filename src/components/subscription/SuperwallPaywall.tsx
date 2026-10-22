import { useEffect, useRef } from 'react';

import { superwall, usePurchasesStore } from '@/lib/purchases';

export type SuperwallPaywallOutcome = 'purchased' | 'closed' | 'unavailable';

type Props = {
  /** Placement name, as set up in the Superwall dashboard (onboarding, limit, moment, reminder, winback, settings). */
  placement: string;
  /** Sent with the placement, for audience rules and paywall text. */
  params?: Record<string, string | number | boolean>;
  /** Called once: bought / restored, closed, or nothing could be shown (the caller shows ours). */
  onDone: (outcome: SuperwallPaywallOutcome) => void;
  /** The paywall is on screen (e.g. to draw what comes next underneath it). */
  onPresent?: () => void;
};

/**
 * Shows the paywall designed in the Superwall dashboard for a placement. Renders nothing itself.
 * Mount only where `superwall` is set (BILLING_AVAILABLE).
 */
export function SuperwallPaywall({ placement, params, onDone, onPresent }: Props) {
  const finished = useRef(false);
  const presented = useRef(false);
  const onDoneRef = useRef(onDone);
  const onPresentRef = useRef(onPresent);
  useEffect(() => {
    onDoneRef.current = onDone;
    onPresentRef.current = onPresent;
  }, [onDone, onPresent]);

  const finish = (outcome: SuperwallPaywallOutcome) => {
    if (finished.current) return;
    finished.current = true;
    onDoneRef.current(outcome);
  };

  const { registerPlacement } = superwall!.usePlacement({
    onPresent: () => {
      presented.current = true;
      onPresentRef.current?.();
    },
    onDismiss: (_info, result) => finish(result.type === 'declined' ? 'closed' : 'purchased'),
    // No campaign / audience for this placement, or a holdout: show ours.
    onSkip: () => finish('unavailable'),
    onError: (error) => {
      console.warn('[purchases] Superwall paywall error', error);
      finish('unavailable');
    },
  });

  useEffect(() => {
    registerPlacement({ placement, params })
      .then(() => {
        // Resolves when access is granted. Without a paywall on screen (already subscribed), settle here.
        setTimeout(() => {
          if (!presented.current) finish(usePurchasesStore.getState().entitlement.active ? 'purchased' : 'unavailable');
        }, 500);
      })
      .catch(() => finish('unavailable'));
    // Once, when mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
