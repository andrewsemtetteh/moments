import { useLocalSearchParams, useRouter } from 'expo-router';

import { JoinWithCode } from '@/components/onboarding/JoinWithCode';
import { goNext } from '@/lib/onboarding-v2';
import { goBackOrReplace } from '@/lib/router';
import { useAuthStore } from '@/stores';

/**
 * Join your partner's space with their code. From onboarding's invite step
 * (?from=invite) it carries on with onboarding; from the app (the You page,
 * Home) it goes back to Home once you're connected.
 */
export default function JoinRelationshipScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ from?: string; preview?: string }>();
  const userId = useAuthStore((s) => s.user?.id);
  const preview = params.preview === '1';

  if (params.from === 'invite') {
    return (
      <JoinWithCode
        preview={preview}
        onBack={() => router.back()}
        // Replaces this screen: Back from the next step goes to the invite step
        // (which then says you're connected), not to a code you've already used.
        onJoined={() => void goNext(router, 'invite', { userId, preview, replace: true })}
      />
    );
  }

  return (
    <JoinWithCode
      preview={preview}
      inOnboarding={false}
      onBack={() => goBackOrReplace(router, '/(tabs)/home')}
      onJoined={() => router.replace('/(tabs)/home')}
    />
  );
}
