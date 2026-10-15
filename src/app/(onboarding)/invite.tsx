import { useAuth } from '@clerk/expo';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from '@/lib/haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { CoupleCharacters } from '@/components/onboarding/Characters';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { ensureOnboardingSpace, syncSpaceWithDraft } from '@/lib/onboarding-space';
import { goNext } from '@/lib/onboarding-v2';
import { inviteLink } from '@/constants/links';
import { getPendingInvite } from '@/lib/pending-links';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { formatInviteCode } from '@/lib/invite-code';
import { getFirstName } from '@/lib/avatar-initial';

/**
 * Step 8: bring your person in. Your space is made here (with the answers so
 * far) if you don't have one yet, so there's always a code to share. Already
 * got theirs? Join instead. Nobody has to wait on this screen.
 */
export default function InviteScreen() {
  const router = useRouter();
  const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const { getToken } = useAuth();
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const [code, setCode] = useState<string | null>(preview ? 'K7Q2PX9A' : relationship?.invite_code ?? null);
  const [error, setError] = useState(false);
  // Tapping the code copies it; "Copied" shows for a moment. Continue always moves on.
  const [copied, setCopied] = useState(false);
  // Bumped by "Try again" when making the code failed.
  const [attempt, setAttempt] = useState(0);

  // Arrived already paired (joined their code before quitting): nothing to
  // invite, so skip ahead. Replaced, so Back from the next step doesn't land here.
  // Paired while here (joined from this screen): this screen says so instead.
  const [pairedOnArrival] = useState(() => !preview && !!partner);
  useEffect(() => {
    if (pairedOnArrival) void goNext(router, 'invite', { userId: user?.id, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Usually ready already: the space started being made two steps ago (theme step).
  useEffect(() => {
    if (preview || partner || code || !user) return;
    let cancelled = false;
    ensureOnboardingSpace(user.id, getToken)
      .then((rel) => {
        if (cancelled) return;
        setCode(rel.invite_code ?? null);
        void syncSpaceWithDraft(user.id, rel, getToken).catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [preview, partner, code, user, getToken, attempt]);

  // For people who'd rather send it straight to them than copy and paste.
  // Opened your partner's invite link? Go straight to joining their space.
  useEffect(() => {
    if (preview || partner) return;
    let cancelled = false;
    void getPendingInvite().then((pending) => {
      if (pending && !cancelled) router.push({ pathname: '/(onboarding)/join-relationship', params: { from: 'invite' } });
    });
    return () => {
      cancelled = true;
    };
  }, [preview, partner, router]);

  const share = async () => {
    if (!code) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `Join me on Moments, our private little space: ${inviteLink(code)}\n\nOr enter my code ${formatInviteCode(code)} when you sign up.`,
    });
  };
  const next = () => void goNext(router, 'invite', { userId: user?.id, preview });

  const copy = async () => {
    if (!code) return;
    await Clipboard.setStringAsync(code);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
  };

  // "Copied" shows for a moment, then the hint comes back.
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  if (partner && !preview) {
    const them = getFirstName(partner.name) ?? 'your person';
    return (
      <OnboardingStepScreen
        step="invite"
        art={<CoupleCharacters width={190} />}
        centered
        title={`You’re connected with ${them}`}
        subtitle="Your space is shared now. Everything you add, they see too."
        primaryLabel="Continue"
        onPrimary={next}
      />
    );
  }

  return (
    <OnboardingStepScreen
      step="invite"
      art={<CoupleCharacters width={190} waiting />}
      title="Moments is made for two. Invite your person."
      subtitle="Send them your code. They set up their own name and photo, and the moment they join you’re connected."
      primaryLabel="Continue"
      onPrimary={next}
      secondaryLabel="I’ll invite them later"
      onSecondary={next}>
      <View style={[styles.card, { borderColor: colors.text, backgroundColor: colors.surface }]}>
        {copied ? (
          <Animated.View entering={FadeIn.duration(150)} style={styles.copiedRow}>
            <Icon name="check" size={14} color={colors.success} />
            <Text style={[styles.codeLabel, { color: colors.success }]}>Copied</Text>
          </Animated.View>
        ) : (
          <Text style={[styles.codeLabel, { color: colors.textSecondary }]}>Your code · tap to copy</Text>
        )}
        {code ? (
          <Pressable onPress={() => void copy()} accessibilityRole="button" accessibilityLabel={`Code ${formatInviteCode(code)}, tap to copy`}>
            <Text style={[styles.code, { color: colors.text }]}>{formatInviteCode(code)}</Text>
          </Pressable>
        ) : error ? (
          <Pressable
            onPress={() => {
              setError(false);
              setAttempt((n) => n + 1);
            }}
            hitSlop={8}
            accessibilityRole="button">
            <Text style={[styles.err, { color: colors.textSecondary }]}>
              Couldn’t make your code. <Text style={[styles.retry, { color: colors.text }]}>Try again</Text>
            </Text>
          </Pressable>
        ) : (
          <ActivityIndicator color={colors.text} style={styles.loader} />
        )}
        {code ? (
          <Pressable
            onPress={() => void share()}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Share your code"
            style={({ pressed }) => [styles.shareRow, pressed && styles.pressed]}>
            <Icon name="share" size={14} color={colors.textSecondary} />
            <Text style={[styles.shareText, { color: colors.textSecondary }]}>Share</Text>
          </Pressable>
        ) : null}
      </View>

      {/* A quiet text link, not another button. */}
      <Pressable
        onPress={() =>
          router.push({ pathname: '/(onboarding)/join-relationship', params: { from: 'invite', ...(preview ? { preview: '1' } : {}) } })
        }
        hitSlop={10}
        accessibilityRole="link"
        style={({ pressed }) => [styles.joinLink, pressed && styles.pressed]}>
        <Text style={[styles.joinLinkText, { color: colors.textSecondary }]}>
          Got a code from them? <Text style={[styles.joinLinkAction, { color: colors.text }]}>Join their space</Text>
        </Text>
      </Pressable>
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderWidth: 2, borderRadius: 22, padding: 18, alignItems: 'center', gap: 10 },
  codeLabel: { fontSize: 13, fontWeight: '800' },
  copiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  code: { fontSize: 34, fontWeight: '900', letterSpacing: 4 },
  loader: { height: 41 },
  err: { fontSize: 14, textAlign: 'center' },
  retry: { fontWeight: '800', textDecorationLine: 'underline' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  shareText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  joinLink: { alignItems: 'center', paddingVertical: 6 },
  joinLinkText: { fontSize: 15, fontWeight: '400' },
  joinLinkAction: { fontWeight: '500', textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
});
