import * as StoreReview from 'expo-store-review';
import { useEffect } from 'react';

import { ensureStoreReviewFirstOpen, markReviewPromptAsked, shouldShowRatingPage } from '@/lib/store-review';
import { trackForCouple } from '@/services/analytics';

/**
 * Asking for a rating: once they've used Moments on 7 different days (and no sooner than
 * two months after the last ask), the store's own review prompt. Nothing of ours in front of it:
 * a "Do you enjoy it?" question that only sent happy people to the store is review gating,
 * which the App Store (5.6.1) and Google Play don't allow. Apple and Google also decide
 * whether the prompt actually shows, and cap how often.
 *
 * Feedback and "Rate Moments" (straight to the store) stay in Settings.
 */
export function StoreReviewSync() {
  useEffect(() => {
    void ensureStoreReviewFirstOpen();
    const timer = setTimeout(() => {
      void (async () => {
        if (!(await shouldShowRatingPage())) return;
        if (!(await StoreReview.isAvailableAsync().catch(() => false))) return;
        // Counts as an ask whether or not the system chose to show it.
        await markReviewPromptAsked();
        void trackForCouple('rating_prompt_requested', {});
        await StoreReview.requestReview().catch(() => undefined);
      })();
    }, 4000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}
