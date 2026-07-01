import type { ExploreModalKey } from '@/components/activities/ExploreSection';
import { useUIStore } from '@/stores';
import type { Href } from 'expo-router';
import { router, useRouter } from 'expo-router';

export type AppTab = 'home' | 'activities' | 'calendar' | 'profile' | 'chat' | 'notifications';

export function goBackOrReplace(routerInstance: ReturnType<typeof useRouter>, fallback: Href) {
  if (routerInstance.canGoBack()) {
    routerInstance.back();
    return;
  }
  routerInstance.replace(fallback);
}

export function openActivities(modal?: ExploreModalKey) {
  if (modal) {
    router.push({ pathname: '/(tabs)/activities', params: { open: modal } });
  } else {
    router.navigate('/(tabs)/activities');
  }
}

export function openChat(draft?: string) {
  if (draft?.trim()) {
    useUIStore.getState().setChatDraft(draft.trim());
  }
  router.push('/(tabs)/chat');
}

export function openCalendar(options?: { create?: boolean; dateISO?: string }) {
  const date = options?.dateISO?.slice(0, 10);
  if (date || options?.create) {
    router.push({
      pathname: '/(tabs)/calendar',
      params: {
        ...(date ? { date } : {}),
        ...(options?.create ? { create: '1' } : {}),
      },
    });
  } else {
    router.navigate('/(tabs)/calendar');
  }
}
