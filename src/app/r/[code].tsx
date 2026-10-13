import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { setPendingReferral } from '@/lib/pending-links';

/**
 * A referral link from another couple (moments://r/CODE or https://<domain>/r/CODE).
 * The code is claimed once you're signed in (ReferralClaimSync); both couples
 * get Plus when you pair with your partner.
 */
export default function ReferralLinkScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const clean = String(code ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    void (clean ? setPendingReferral(clean) : Promise.resolve()).finally(() => setReady(true));
  }, [code]);
  return ready ? <Redirect href="/" /> : null;
}
