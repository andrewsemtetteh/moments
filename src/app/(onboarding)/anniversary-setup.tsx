import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnniversaryDatePicker } from '@/components/onboarding/AnniversaryDatePicker';
import { OnboardingChrome } from '@/components/onboarding/OnboardingChrome';
import { PrimaryButton } from '@/components/ui/primitives';
import { PromptLink } from '@/components/ui/PromptLink';
import { Spacing } from '@/constants/design-system';
import { formatAnniversaryForDb } from '@/lib/anniversary';
import { goToOnboardingBack } from '@/lib/onboarding-navigation';
import { isAvatarPromptDone } from '@/lib/onboarding-storage';
import { needsProfileSetup, profileSetupEntryRoute } from '@/lib/profile-setup';
import { useAuthStore } from '@/stores';

export default function AnniversarySetupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const [anniversaryDate, setAnniversaryDate] = useState(formatAnniversaryForDb(new Date()));

  useEffect(() => {
    let cancelled = false;

    async function guardProfile() {
      if (!user) {
        router.replace('/(auth)/login');
        return;
      }
      const avatarDone = await isAvatarPromptDone(user.id);
      if (cancelled) return;
      if (needsProfileSetup(user, avatarDone)) {
        router.replace(profileSetupEntryRoute(user, avatarDone) as never);
      }
    }

    void guardProfile();

    return () => {
      cancelled = true;
    };
  }, [router, user]);

  const goToRelationshipType = (date: string | null) => {
    router.push({
      pathname: '/(onboarding)/relationship-type',
      params: date ? { anniversaryDate: date } : { anniversarySkipped: '1' },
    });
  };

  const goBack = () => goToOnboardingBack(router, 'anniversary-setup');

  return (
    <OnboardingChrome stepId="anniversary-setup" onBack={goBack}>
      <View style={[styles.content, { paddingBottom: insets.bottom + Spacing.lg, paddingHorizontal: Spacing.lg }]}>
        <AnniversaryDatePicker value={anniversaryDate} onChange={setAnniversaryDate} />

        <PrimaryButton
          label="Continue"
          onPress={() => goToRelationshipType(anniversaryDate)}
          style={styles.btn}
        />

        <PromptLink
          prompt="Not sure yet?"
          linkLabel="Skip for now"
          onPress={() => goToRelationshipType(null)}
        />
      </View>
    </OnboardingChrome>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  btn: { width: '100%', marginTop: 28 },
});
