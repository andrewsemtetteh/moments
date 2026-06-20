import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnniversaryDatePicker } from '@/components/onboarding/AnniversaryDatePicker';
import { PrimaryButton } from '@/components/ui/primitives';
import { PromptLink } from '@/components/ui/PromptLink';
import { useTheme } from '@/hooks/useTheme';
import { formatAnniversaryForDb } from '@/lib/anniversary';
import { markRelationshipOnboardingDone } from '@/lib/onboarding-storage';
import { useAuthStore } from '@/stores';

export default function AnniversarySetupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [anniversaryDate, setAnniversaryDate] = useState(formatAnniversaryForDb(new Date()));

  const goToCreate = async (date: string | null) => {
    if (user) await markRelationshipOnboardingDone(user.id);
    router.push({
      pathname: '/(onboarding)/create-relationship',
      params: date ? { anniversaryDate: date } : { anniversarySkipped: '1' },
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        <AnniversaryDatePicker value={anniversaryDate} onChange={setAnniversaryDate} />

        <PrimaryButton
          label="Continue"
          onPress={() => goToCreate(anniversaryDate)}
          style={styles.btn}
        />

        <PromptLink
          prompt="Not sure yet?"
          linkLabel="Skip for now"
          onPress={() => goToCreate(null)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center', alignItems: 'center' },
  btn: { width: '100%', marginTop: 28 },
});
