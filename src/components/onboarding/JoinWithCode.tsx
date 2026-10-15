import { useAuth } from '@clerk/expo';
import LottieView from 'lottie-react-native';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { TextInput } from '@/components/ui/ThemedTextInput';

import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { useTheme } from '@/hooks/useTheme';
import { formatInviteCode, INVITE_CODE_LENGTH, normalizeInviteCode } from '@/lib/invite-code';
import { joinRelationshipByInvite } from '@/lib/moments-api';
import { markRelationshipOnboardingDone } from '@/lib/onboarding-storage';
import { clearPendingInvite, getPendingInvite } from '@/lib/pending-links';
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
  inOnboarding = true,
}: {
  preview: boolean;
  onJoined: () => void;
  onBack: () => void;
  /** Shows the onboarding progress bar; off when opened from the app (You page, Home). */
  inOnboarding?: boolean;
}) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const { getToken } = useAuth();
  const setRelationship = useRelationshipStore((s) => s.setRelationship);
  const setPartner = useRelationshipStore((s) => s.setPartner);
  const [code, setCode] = useState('');
  // Filled in from your partner's invite link, if you opened one.
  useEffect(() => {
    void getPendingInvite().then((pending) => {
      if (pending) setCode((c) => c || normalizeInviteCode(pending).slice(0, INVITE_CODE_LENGTH));
    });
  }, []);
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (preview) {
      onJoined();
      return;
    }
    if (!user || code.length < INVITE_CODE_LENGTH) return;
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in');
      const { relationship, partner } = await joinRelationshipByInvite(token, code);
      await markRelationshipOnboardingDone(user.id);
      setRelationship(relationship);
      void trackForCouple(AnalyticsEvents.PARTNER_JOINED);
      setPartner(partner);
      queryClient.clear();
      await clearPendingInvite();
      onJoined();
    } catch (e) {
      Alert.alert('Couldn’t join', e instanceof Error ? e.message : 'Check the code and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingStepScreen
      step={inOnboarding ? 'invite' : undefined}
      art={
        <LottieView source={require('../../../assets/lottie/join-connect.json')} autoPlay loop style={styles.lottie} />
      }
      title="Join your person’s space"
      subtitle="Type the code they sent you. You’ll be connected straight away."
      primaryLabel="Join"
      onPrimary={() => void join()}
      primaryDisabled={!preview && code.length < INVITE_CODE_LENGTH}
      busy={busy}
      centered
      onBack={onBack}>
      <TextInput
        value={formatInviteCode(code)}
        onChangeText={(t) => setCode(normalizeInviteCode(t).slice(0, INVITE_CODE_LENGTH))}
        placeholder="ABCD-1234"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={INVITE_CODE_LENGTH + 1}
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
    letterSpacing: 4,
  },
});
