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
    // Not just once: every time the navigation changes. A sign-in or onboarding screen can
    // end up under the tabs later (or after the first few seconds), and Back or an
    // accidental swipe then dropped an existing account into onboarding.
    let id: ReturnType<typeof setInterval> | null = null;
    if (!clear()) {
      // The container can still be settling on the first frame.
      id = setInterval(() => {
        if (clear() && id) clearInterval(id);
      }, 100);
    }
    const unsubscribe = nav.addListener('state', () => {
      clear();
    });
    return () => {
      if (id) clearInterval(id);
      unsubscribe();
    };
  }, [nav]);

  return null;
}
