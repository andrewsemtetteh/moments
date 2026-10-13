import { useAuth } from '@clerk/expo';
import LottieView from 'lottie-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, TextInput } from 'react-native';

import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { useTheme } from '@/hooks/useTheme';
import { joinRelationshipByInvite } from '@/lib/moments-api';
import { markRelationshipOnboardingDone } from '@/lib/onboarding-storage';
import { queryClient } from '@/providers/AppProviders';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { AnalyticsEvents, trackForCouple } from '@/services/analytics';

/**
 * "They already sent me a code": join their space. Opens calm (no keyboard
 * jumping up); tap the code box to type. Your own empty space closes when
 * you join theirs.
 */
export function JoinWithCode({
  preview,
  onJoined,
  onBack,
}: {
  preview: boolean;
  onJoined: () => void;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const { getToken } = useAuth();
  const setRelationship = useRelationshipStore((s) => s.setRelationship);
  const setPartner = useRelationshipStore((s) => s.setPartner);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (preview) {
      onJoined();
      return;
    }
    if (!user || code.trim().length < 6) return;
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in');
      const { relationship, partner } = await joinRelationshipByInvite(token, code.trim());
      await markRelationshipOnboardingDone(user.id);
      setRelationship(relationship);
      void trackForCouple(AnalyticsEvents.PARTNER_JOINED);
      setPartner(partner);
      queryClient.clear();
      onJoined();
    } catch (e) {
      Alert.alert('Couldn’t join', e instanceof Error ? e.message : 'Check the code and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingStepScreen
      step="invite"
      art={
        <LottieView source={require('../../../assets/lottie/join-connect.json')} autoPlay loop style={styles.lottie} />
      }
      title="Join your person’s space"
      subtitle="Type the 6 character code they sent you. You’ll be connected straight away."
      primaryLabel="Join"
      onPrimary={() => void join()}
      primaryDisabled={!preview && code.trim().length < 6}
      busy={busy}
      centered
      onBack={onBack}>
      <TextInput
        value={code}
        onChangeText={(t) =>
          setCode(
            t
              .replace(/[^a-zA-Z0-9]/g, '')
              .toUpperCase()
              .slice(0, 6),
          )
        }
        placeholder="K7Q2PX"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        returnKeyType="go"
        onSubmitEditing={() => void join()}
        style={[styles.input, { color: colors.text, borderColor: colors.text, backgroundColor: colors.surface }]}
      />
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  lottie: { width: 230, height: 170 },
  input: {
    height: 66,
    borderRadius: 18,
    borderWidth: 2,
    textAlign: 'center',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 8,
  },
});
