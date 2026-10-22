import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { loadSignedInAccount } from '@/lib/auth-session';

/**
 * The last step of every sign-in: load the account, then open the app. `entering` stays on
 * until the app opens, so the button keeps saying it's signing in instead of looking idle.
 */
export function useEnterApp() {
  const router = useRouter();
  const [entering, setEntering] = useState(false);

  const enter = useCallback(async () => {
    setEntering(true);
    try {
      await loadSignedInAccount();
      router.replace('/');
    } catch (e) {
      setEntering(false);
      Alert.alert('Couldn’t open your account', e instanceof Error ? e.message : 'Check your connection and try again.');
    }
  }, [router]);

  return { enter, entering };
}
