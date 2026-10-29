import { useAuth } from '@clerk/expo';
import LottieView from 'lottie-react-native';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { TextInput } from '@/components/ui/ThemedTextInput';

import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { useTheme } from '@/hooks/useTheme';
import { formatInviteCode, INVITE_CODE_LENGTH, normalizeInviteCode } from '@/lib/invite-code';
import { Icon } from '@/components/ui/Icon';
import { fieldOutline } from '@/components/ui/primitives';
import { joinRelationshipByInvite, MomentsApiError } from '@/lib/moments-api';
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
  // Filled in from your partner's invite link, if you opened one. The saved code is then
  // used up, so it can't keep reopening this screen once you've seen it.
  useEffect(() => {
    void getPendingInvite().then((pending) => {
      if (!pending) return;
      setCode((c) => c || normalizeInviteCode(pending).slice(0, INVITE_CODE_LENGTH));
      void clearPendingInvite();
    });
  }, []);
  const [busy, setBusy] = useState(false);
  // Why the last try didn't work, shown under the code (cleared as soon as they edit it).
  const [error, setError] = useState<string | null>(null);
  // The field's outline takes the theme colour while typing.
  const [focused, setFocused] = useState(false);

  const join = async () => {
    if (preview) {
      onJoined();
      return;
    }
    if (!user || code.length < INVITE_CODE_LENGTH) return;
    setError(null);
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
      setError(joinErrorMessage(e));
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
        onChangeText={(t) => {
          setCode(normalizeInviteCode(t).slice(0, INVITE_CODE_LENGTH));
          if (error) setError(null);
        }}
        placeholder="ABCD-1234"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={INVITE_CODE_LENGTH + 1}
        returnKeyType="go"
        onSubmitEditing={() => void join()}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.surface },
          fieldOutline(colors, { focused, error: !!error }),
        ]}
      />
      {/* What went wrong, in plain words, right where they're looking. */}
      {error ? (
        <Animated.View entering={FadeIn.duration(180)} style={styles.errorRow} accessibilityLiveRegion="polite">
          <Icon name="warning" size={16} color={colors.error} />
          <Text style={[styles.errorText, { color: colors.error }]}>{error}</Text>
        </Animated.View>
      ) : null}
    </OnboardingStepScreen>
  );
}

/** A clear reason (and what to do) for each way joining can fail. */
function joinErrorMessage(e: unknown): string {
  if (e instanceof MomentsApiError) {
    if (e.status === 404) {
      return 'We couldn’t find that code. Check it with your person: it may have changed if they made a new one, or their space may already be joined.';
    }
    if (e.status === 429) return 'Too many tries. Wait a few minutes, then try again.';
    // e.g. "That's your own code…" — the server's words are already clear.
    if (e.status === 400 && e.message) return e.message;
    return 'Something went wrong on our side. Please try again.';
  }
  return 'Couldn’t reach Moments. Check your connection and try again.';
}

const styles = StyleSheet.create({
  lottie: { width: 230, height: 170 },
  errorRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: 6, paddingHorizontal: 8 },
  errorText: { flexShrink: 1, fontSize: 14, fontWeight: '700', lineHeight: 19, textAlign: 'center' },
  input: {
    height: 66,
    borderRadius: 18,
    textAlign: 'center',
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: 4,
  },
});
