import { useEffect } from 'react';

import {
  ensureStoreReviewFirstOpen,
  maybeAutoPromptStoreReview,
} from '@/lib/store-review';

/** Tracks first open and may show the native store review sheet after 3 days. */
export function StoreReviewSync() {
  useEffect(() => {
    void ensureStoreReviewFirstOpen();

    const timer = setTimeout(() => {
      void maybeAutoPromptStoreReview();
    }, 2800);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
