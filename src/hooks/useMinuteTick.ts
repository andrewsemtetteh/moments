import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * The current time, updated exactly on each real-world minute boundary — not a fixed 60s from
 * mount, which can leave a display showing a stale minute for up to 59s. Also updates (and
 * re-aligns) on app foreground, since background JS timers can be throttled/suspended and
 * drift while the app is backgrounded.
 *
 * Use the returned time for anything clock-based in render. The React Compiler memoizes by
 * inputs, so a bare `new Date()` (or a clock helper that defaults to it) is computed once and
 * never changes; passing this in makes each minute a new input.
 */
export function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const bump = () => setNow(new Date());

    const scheduleAligned = () => {
      const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
      timeoutId = setTimeout(() => {
        bump();
        intervalId = setInterval(bump, 60_000);
      }, msUntilNextMinute);
    };

    scheduleAligned();

    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') return;
      bump();
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
      scheduleAligned();
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (intervalId) clearInterval(intervalId);
      sub.remove();
    };
  }, []);

  return now;
}
