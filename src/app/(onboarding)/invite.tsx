import { useAuth } from '@clerk/expo';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { CoupleCharacters } from '@/components/onboarding/Characters';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { createRelationship, ensureInviteCode } from '@/lib/moments-api';
import { markRelationshipOnboardingDone } from '@/lib/onboarding-storage';
import { getOnboardingDraft, goNext } from '@/lib/onboarding-v2';
import { useAuthStore, useRelationshipStore } from '@/stores';

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
  const setRelationship = useRelationshipStore((s) => s.setRelationship);
  const [code, setCode] = useState<string | null>(preview ? 'K7Q2PX' : relationship?.invite_code ?? null);
  const [error, setError] = useState(false);
  // Tapping the code copies it; "Copied" shows for a moment. Continue always moves on.
  const [copied, setCopied] = useState(false);

  // Already paired (joined their code earlier): nothing to invite.
  useEffect(() => {
    if (!preview && partner) void goNext(router, 'invite', { userId: user?.id });
  }, [preview, partner, router, user?.id]);

  useEffect(() => {
    if (preview || partner || code || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('Not signed in');
        let rel = relationship;
        if (!rel || rel.status === 'ended') {
          const draft = await getOnboardingDraft(user.id);
          rel = await createRelationship(token, {
            relationship_name: draft.spaceName?.trim() || 'Our space',
            anniversary_date: draft.anniversaryDate ?? null,
            relationship_type: draft.relationshipType ?? null,
          });
          await markRelationshipOnboardingDone(user.id);
        }
        const invite = rel.invite_code ?? (await ensureInviteCode(token, rel.id));
        if (cancelled) return;
        setRelationship({ ...rel, invite_code: invite });
        setCode(invite);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [preview, partner, code, user, relationship, getToken, setRelationship]);

  // For people who'd rather send it straight to them than copy and paste.
  const share = async () => {
    if (!code) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Share.share({
      message: `Join me on Moments, our private little space. Use my code ${code} when you sign up.`,
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
          <Pressable onPress={() => void copy()} accessibilityRole="button" accessibilityLabel={`Code ${code}, tap to copy`}>
            <Text style={[styles.code, { color: colors.text }]}>{code}</Text>
          </Pressable>
        ) : error ? (
          <Text style={[styles.err, { color: colors.textSecondary }]}>Couldn’t make your code. Check your connection.</Text>
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
  code: { fontSize: 34, fontWeight: '900', letterSpacing: 8 },
  loader: { height: 41 },
  err: { fontSize: 14, textAlign: 'center' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  shareText: { fontSize: 14, fontWeight: '600', textDecorationLine: 'underline' },
  joinLink: { alignItems: 'center', paddingVertical: 6 },
  joinLinkText: { fontSize: 15, fontWeight: '400' },
  joinLinkAction: { fontWeight: '500', textDecorationLine: 'underline' },
  pressed: { opacity: 0.6 },
});
