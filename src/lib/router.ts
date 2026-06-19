import type { Href } from 'expo-router';
import { useRouter } from 'expo-router';

export function goBackOrReplace(router: ReturnType<typeof useRouter>, fallback: Href) {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(fallback);
}
