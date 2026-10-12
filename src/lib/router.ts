import type { ExploreModalKey } from '@/components/activities/explore/explore-catalog';
import { useUIStore } from '@/stores';
import type { Href } from 'expo-router';
import { router, useRouter } from 'expo-router';

export type AppTab = 'home' | 'activities' | 'profile';

/** Leave the current screen for `fallback` (navigates — reuses the screen if it's already in the stack). */
export function goBackOrReplace(routerInstance: ReturnType<typeof useRouter>, fallback: Href) {
  routerInstance.navigate(fallback);
}

/**
 * Close a root-stack screen pushed over the tabs (Chat, Plan, Notifications): pop back to
 * whichever tab opened it, so the native pop animation plays and you land
 * where you were — not always Home. Falls back to Home if it was opened
 * directly (deep link / notification with nothing underneath).
 */
export function closeStackScreen(routerInstance: ReturnType<typeof useRouter>) {
  if (routerInstance.canGoBack()) routerInstance.back();
  else routerInstance.replace('/(tabs)/home');
}

export function openActivities(modal?: ExploreModalKey) {
  if (modal) {
    // navigate, not push — may be called from a stack screen above the tabs
    // (e.g. Notifications), where push would stack a duplicate tab navigator.
    router.navigate({ pathname: '/(tabs)/activities', params: { open: modal } });
  } else {
    router.navigate('/(tabs)/activities');
  }
}

export function openChat(draft?: string) {
  if (draft?.trim()) {
    useUIStore.getState().setChatDraft(draft.trim());
  }
  router.navigate('/chat');
}

export function openCalendar(options?: { create?: boolean; dateISO?: string }) {
  const date = options?.dateISO?.slice(0, 10);
  if (date || options?.create) {
    router.navigate({
      pathname: '/calendar',
      params: {
        ...(date ? { date } : {}),
        ...(options?.create ? { create: '1' } : {}),
      },
    });
  } else {
    router.navigate('/calendar');
  }
}
