import type { ReactNode } from 'react';
import { useCallback } from 'react';
import { BackHandler, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { StoryProgressTopBar } from '@/components/onboarding/StoryProgressTopBar';
import { Icon } from '@/components/ui/Icon';
import {
  ONBOARDING_PROGRESS_TOTAL,
  type OnboardingFlowStepId,
  getOnboardingProgressIndex,
} from '@/constants/onboarding-flow';
import { useTheme } from '@/hooks/useTheme';

const BACK_BUTTON_SIZE = 40;

type Props = {
  stepId: OnboardingFlowStepId;
  onBack: () => void;
  children: ReactNode;
};

function OnboardingBackButton({ onPress }: { onPress: () => void }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      hitSlop={8}
      style={({ pressed }) => [
        styles.backCircle,
        {
          backgroundColor: pressed ? colors.surfaceElevated : colors.surface,
          borderColor: colors.border,
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel="Go back">
      <Icon name="chevronLeft" size={20} color={colors.text} strokeWidth={2.2} />
    </Pressable>
  );
}

export function OnboardingChrome({ stepId, onBack, children }: Props) {
  const { colors } = useTheme();
  const progressIndex = getOnboardingProgressIndex(stepId);
  const showBack = progressIndex > 0;

  useFocusEffect(
    useCallback(() => {
      if (!showBack) return undefined;
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
        leading={showBack ? <OnboardingBackButton onPress={onBack} /> : undefined}
      />
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1 },
  backCircle: {
    width: BACK_BUTTON_SIZE,
    height: BACK_BUTTON_SIZE,
    borderRadius: BACK_BUTTON_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
