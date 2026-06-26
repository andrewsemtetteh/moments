import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IntroPager } from '@/components/onboarding/IntroPager';
import { WelcomeBackdrop } from '@/components/onboarding/WelcomeBackdrop';
import { markIntroCompleted } from '@/lib/intro-storage';

export default function IntroScreen() {
  const router = useRouter();

  const finishIntro = async (destination: '/(auth)/signup' | '/(auth)/login') => {
    await markIntroCompleted();
    router.replace(destination);
  };

  const handleComplete = () => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void finishIntro('/(auth)/signup');
  };

  const handleClose = () => {
    void Haptics.selectionAsync();
    void finishIntro('/(auth)/signup');
  };

  const handleSkipToLogin = () => {
    void Haptics.selectionAsync();
    void finishIntro('/(auth)/login');
  };

  return (
    <WelcomeBackdrop>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        <IntroPager onComplete={handleComplete} onClose={handleClose} onSkip={handleSkipToLogin} />
      </SafeAreaView>
    </WelcomeBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
});
