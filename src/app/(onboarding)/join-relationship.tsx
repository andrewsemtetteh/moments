import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingChrome } from '@/components/onboarding/OnboardingChrome';
import { PromptLink } from '@/components/ui/PromptLink';
import { PrimaryButton } from '@/components/ui/primitives';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import {
  buildOnboardingRelationshipParams,
  hasChosenSpacePath,
  hasCompletedPreSpaceOnboarding,
  paramsFromSearch,
  type OnboardingRelationshipParams,
} from '@/lib/onboarding-relationship-params';
import { markRelationshipOnboardingDone } from '@/lib/onboarding-storage';
import { goToOnboardingBack } from '@/lib/onboarding-navigation';
import { goBackOrReplace } from '@/lib/router';
import { queryClient } from '@/providers/AppProviders';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { RelationshipType } from '@/types/database';

function JoinRelationshipContent({
  fromProfile,
  relationshipType,
  onboardingParams,
  onBack,
}: {
  fromProfile: boolean;
  relationshipType: RelationshipType | null;
  onboardingParams?: OnboardingRelationshipParams;
  onBack?: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const setRelationship = useRelationshipStore((s) => s.setRelationship);
  const setPartner = useRelationshipStore((s) => s.setPartner);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const join = async () => {
    if (!user || !code.trim()) return;
    setLoading(true);
    try {
      let { relationship, partner } = await api.joinRelationship(user.id, code.trim());
      if (relationshipType && !relationship.relationship_type) {
        relationship = await api.updateRelationship(relationship.id, {
          relationship_type: relationshipType,
        });
      }
      await markRelationshipOnboardingDone(user.id);
      setRelationship(relationship);
      setPartner(partner);
      queryClient.clear();
      router.replace({
        pathname: '/(onboarding)/notification-prompt',
        params: { next: 'welcome' },
      });
    } catch (e: unknown) {
      Alert.alert('Could not join', e instanceof Error ? e.message : 'Please check the code and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View
      style={[
        styles.content,
        { paddingBottom: insets.bottom + Spacing.lg, paddingHorizontal: Spacing.lg },
      ]}>
      <Text style={[styles.title, { color: colors.text }]}>Join your partner</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {fromProfile
          ? 'Enter your partner\u2019s 6-character code. If you already created a space, your empty one will close when you join theirs.'
          : 'Enter the 6-character invite code they shared with you'}
      </Text>

      <TextInput
        style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
        placeholder="ABC123"
        placeholderTextColor={colors.textTertiary}
        value={code}
        onChangeText={(t) => setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
        autoCapitalize="characters"
        maxLength={6}
        autoFocus
      />

      <PrimaryButton
        label={loading ? 'Joining…' : 'Join Relationship'}
        onPress={join}
        loading={loading}
        disabled={code.length < 6}
        style={styles.btn}
      />

      {fromProfile ? (
        <PromptLink prompt="Changed your mind?" linkLabel="Back to Profile" onPress={onBack} />
      ) : (
        <PromptLink
          prompt="Starting fresh?"
          linkLabel="Create a space"
          href={{
            pathname: '/(onboarding)/create-relationship',
            params: buildOnboardingRelationshipParams({
              ...paramsFromSearch(onboardingParams ?? {}),
              spacePathChosen: 'create',
            }),
          }}
        />
      )}
    </View>
  );
}

export default function JoinRelationshipScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<OnboardingRelationshipParams & { from?: string }>();
  const { colors } = useTheme();
  const fromProfile = params.from === 'profile';
  const parsed = paramsFromSearch(params);
  const relationshipType = parsed.relationshipType ?? null;

  useEffect(() => {
    if (fromProfile) return;
    if (params.spacePathChosen === 'join') return;
    if (hasCompletedPreSpaceOnboarding(params) && !hasChosenSpacePath(params)) {
      router.replace({
        pathname: '/(onboarding)/relationship-path',
        params: buildOnboardingRelationshipParams(parsed),
      });
      return;
    }
    if (!hasCompletedPreSpaceOnboarding(params)) {
      router.replace('/(onboarding)/anniversary-setup');
    }
  }, [
    fromProfile,
    router,
    params.anniversaryDate,
    params.anniversarySkipped,
    params.relationshipType,
    params.relationshipTypeSkipped,
    params.spacePathChosen,
  ]);

  const goBack = () => goBackOrReplace(router, '/(tabs)/profile');

  if (fromProfile) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <JoinRelationshipContent fromProfile onBack={goBack} relationshipType={null} />
      </SafeAreaView>
    );
  }

  const goBackOnboarding = () => goToOnboardingBack(router, 'join-relationship', parsed);

  return (
    <OnboardingChrome stepId="join-relationship" onBack={goBackOnboarding}>
      <JoinRelationshipContent
        fromProfile={false}
        relationshipType={relationshipType}
        onboardingParams={params}
      />
    </OnboardingChrome>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5, width: '100%' },
  subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 22, marginTop: 10, maxWidth: 320 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 8,
    width: '100%',
    marginTop: 28,
  },
  btn: { width: '100%', marginTop: 20 },
});
