import { useEffect, useMemo, useState } from 'react';

import { getCountdownParts, type CountdownParts } from '@/lib/event-countdown';

/** Live countdown that ticks every second when < 24h away, else every minute. */
export function useLiveCountdown(target: Date | null | undefined): CountdownParts | null {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!target) return;
    const parts = getCountdownParts(target);
    if (parts.isPast) return;

    const intervalMs = parts.isImminent ? 1000 : 60_000;
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [target?.getTime()]);

  return useMemo(() => (target ? getCountdownParts(target, now) : null), [target, now]);
}
