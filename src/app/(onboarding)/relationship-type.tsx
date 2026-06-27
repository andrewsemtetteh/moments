import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingChrome } from '@/components/onboarding/OnboardingChrome';
import { PrimaryButton } from '@/components/ui/primitives';
import { PromptLink } from '@/components/ui/PromptLink';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import {
  buildOnboardingRelationshipParams,
  paramsFromSearch,
  type OnboardingRelationshipParams,
} from '@/lib/onboarding-relationship-params';
import { markRelationshipOnboardingDone } from '@/lib/onboarding-storage';
import { goToOnboardingBack } from '@/lib/onboarding-navigation';
import { RELATIONSHIP_TYPE_OPTIONS } from '@/lib/relationship-type';
import { useAuthStore } from '@/stores';
import type { RelationshipType } from '@/types/database';

export default function RelationshipTypeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const params = useLocalSearchParams<OnboardingRelationshipParams>();
  const [relationshipType, setRelationshipType] = useState<RelationshipType | null>(null);

  const selectType = (value: RelationshipType) => {
    void Haptics.selectionAsync();
    setRelationshipType(value);
  };

  const continueToPath = async (skipped = false) => {
    if (user) await markRelationshipOnboardingDone(user.id);

    const parsed = paramsFromSearch(params);
    const nextParams = buildOnboardingRelationshipParams({
      ...parsed,
      relationshipType: skipped ? null : relationshipType,
      relationshipTypeSkipped: skipped,
    });

    router.push({
      pathname: '/(onboarding)/relationship-path',
      params: nextParams,
    });
  };

  const goBack = () => goToOnboardingBack(router, 'relationship-type', paramsFromSearch(params));

  return (
    <OnboardingChrome stepId="relationship-type" onBack={goBack}>
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.lg, paddingHorizontal: Spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>What&apos;s your situation?</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            We use this to personalize reminders and home copy for your relationship.
          </Text>

          <View style={styles.options}>
            {RELATIONSHIP_TYPE_OPTIONS.map((option) => {
              const selected = relationshipType === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => selectType(option.value)}
                  style={({ pressed }) => [
                    styles.option,
                    {
                      backgroundColor: selected ? colors.accentSoft : colors.surface,
                      borderColor: selected ? colors.accent : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}>
                  <Text
                    style={[
                      styles.optionLabel,
                      { color: selected ? colors.accent : colors.text },
                    ]}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <PrimaryButton
            label="Continue"
            onPress={() => continueToPath(false)}
            disabled={!relationshipType}
            style={styles.btn}
          />

          <PromptLink
            prompt="Prefer not to say?"
            linkLabel="Skip for now"
            onPress={() => continueToPath(true)}
          />
        </View>
      </ScrollView>
    </OnboardingChrome>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400, width: '100%' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 22, marginTop: 10, maxWidth: 320 },
  options: { width: '100%', marginTop: 28, gap: 12 },
  option: {
    width: '100%',
    paddingVertical: 18,
    paddingHorizontal: 20,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
  },
  optionLabel: { fontSize: 17, fontWeight: '600' },
  btn: { width: '100%', marginTop: 32 },
});
