import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StoryProgressTopBar } from '@/components/onboarding/StoryProgressTopBar';
import { HeaderIconButton } from '@/components/ui/HeaderIconButton';
import {
  ONBOARDING_PROGRESS_TOTAL,
  type OnboardingFlowStepId,
  getOnboardingProgressIndex,
} from '@/constants/onboarding-flow';
import { useTheme } from '@/hooks/useTheme';


type Props = {
  stepId: OnboardingFlowStepId;
  /** Omit for steps with no meaningful way back (e.g. a permission prompt after the relationship already exists). */
  onBack?: () => void;
  children: ReactNode;
};

/** Same back icon as every other screen (see HeaderIconButton). */
export function OnboardingBackButton({ onPress }: { onPress: () => void }) {
  return <HeaderIconButton icon="chevronLeft" onPress={onPress} accessibilityLabel="Go back" />;
}

export function OnboardingChrome({ stepId, onBack, children }: Props) {
  const { colors } = useTheme();
  const progressIndex = getOnboardingProgressIndex(stepId);
  const showBack = !!onBack;

  useFocusEffect(
    useCallback(() => {
      if (!showBack || !onBack) return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        onBack();
        return true;
      });
      return () => sub.remove();
    }, [onBack, showBack]),
  );

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: colors.background }]}
      edges={['top', 'left', 'right']}>
      <StoryProgressTopBar
        total={ONBOARDING_PROGRESS_TOTAL}
        index={progressIndex}
        leading={showBack && onBack ? <OnboardingBackButton onPress={onBack} /> : undefined}
      />
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
});
