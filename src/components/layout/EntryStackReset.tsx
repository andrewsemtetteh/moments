import { useNavigationContainerRef } from 'expo-router';
import { useEffect } from 'react';

/** Screens that only lead into the app; once you're in, Back must never return to them. */
const ENTRY_ROUTES = new Set(['index', '(auth)', '(onboarding)', 'pro', 'i/[code]', 'r/[code]']);

/**
 * Signing in, finishing onboarding, joining your partner or closing the
 * paywall all *replace* one screen with Home, which leaves the rest of the
 * sign-in / onboarding screens underneath. Back (or a swipe) then walked
 * into them. When the tabs open, this drops everything below them that's an
 * entry screen, keeping anything opened on top (Chat, Plan…) as it is.
 */
export function EntryStackReset() {
  const nav = useNavigationContainerRef();

  useEffect(() => {
    const clear = () => {
      if (!nav.isReady()) return false;
      const state = nav.getRootState();
      if (!state) return false;
      const tabsAt = state.routes.findIndex((r) => r.name === '(tabs)');
      if (tabsAt <= 0) return true;
      const below = state.routes.slice(0, tabsAt);
      if (!below.some((r) => ENTRY_ROUTES.has(r.name))) return true;
      const routes = state.routes.slice(tabsAt);
      nav.reset({ ...state, routes, index: Math.max(0, state.index - tabsAt) } as never);
      return true;
    };
    if (clear()) return;
    // The container can still be settling on the first frame.
    const id = setInterval(() => {
      if (clear()) clearInterval(id);
    }, 100);
    const stop = setTimeout(() => clearInterval(id), 3000);
    return () => {
      clearInterval(id);
      clearTimeout(stop);
    };
  }, [nav]);

  return null;
}
