import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { setPendingInvite } from '@/lib/pending-links';

/**
 * An invite link from your partner (moments://i/CODE or https://<domain>/i/CODE).
 * The code is kept and filled in at the join step, straight away if you're
 * signed in, or after you sign up.
 */
export default function InviteLinkScreen() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const clean = String(code ?? '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 12);
    void (clean ? setPendingInvite(clean) : Promise.resolve()).finally(() => setReady(true));
  }, [code]);
  return ready ? <Redirect href="/" /> : null;
}
