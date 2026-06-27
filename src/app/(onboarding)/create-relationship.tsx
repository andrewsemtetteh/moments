import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { OnboardingChrome } from '@/components/onboarding/OnboardingChrome';
import { Icon } from '@/components/ui/Icon';
import { colorWithAlpha, PrimaryButton } from '@/components/ui/primitives';
import { PromptLink } from '@/components/ui/PromptLink';
import { Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { markRelationshipOnboardingDone } from '@/lib/onboarding-storage';
import {
  buildOnboardingRelationshipParams,
  hasChosenSpacePath,
  hasCompletedPreSpaceOnboarding,
  paramsFromSearch,
  type OnboardingRelationshipParams,
} from '@/lib/onboarding-relationship-params';
import { goToOnboardingBack } from '@/lib/onboarding-navigation';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';

export default function CreateRelationshipScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<OnboardingRelationshipParams>();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const setRelationship = useRelationshipStore((s) => s.setRelationship);
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const parsed = paramsFromSearch(params);
  const anniversaryDate = parsed.anniversaryDate ?? null;
  const cameFromOnboarding =
    hasCompletedPreSpaceOnboarding(params) && params.spacePathChosen === 'create';
  const relationshipType = parsed.relationshipType ?? null;

  const hasSoloSpace =
    !!relationship && relationship.status !== 'ended' && !relationship.user_2_id;

  useEffect(() => {
    if (!relationship || relationship.status === 'ended' || inviteCode) return;

    if (hasSoloSpace) {
      let cancelled = false;
      const loadExisting = async () => {
        try {
          const rel = relationship.invite_code
            ? relationship
            : await api.ensureInviteCode(relationship.id);
          if (cancelled) return;
          setRelationship(rel);
          setInviteCode(rel.invite_code);
        } catch {
          if (!cancelled) {
            Alert.alert('Could not load your space', 'Go back to Profile and try again.');
          }
        }
      };
      loadExisting();
      return () => {
        cancelled = true;
      };
    }

    if (relationship.user_2_id || relationship.status === 'active') {
      router.replace('/(tabs)/home');
    }
  }, [relationship, inviteCode, hasSoloSpace, router, setRelationship]);

  useEffect(() => {
    if (inviteCode || hasSoloSpace || cameFromOnboarding) return;
    if (hasCompletedPreSpaceOnboarding(params) && !hasChosenSpacePath(params)) {
      router.replace({
        pathname: '/(onboarding)/relationship-path',
        params: buildOnboardingRelationshipParams(paramsFromSearch(params)),
      });
      return;
    }
    router.replace('/(onboarding)/anniversary-setup');
  }, [
    inviteCode,
    hasSoloSpace,
    cameFromOnboarding,
    router,
    params.anniversaryDate,
    params.anniversarySkipped,
    params.relationshipType,
    params.relationshipTypeSkipped,
    params.spacePathChosen,
  ]);

  const create = async () => {
    if (!user) return;
    if (hasSoloSpace) {
      Alert.alert(
        'You already have a space',
        'Share your invite code from Profile, or join your partner\u2019s space instead.',
      );
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert('Name your space', 'Give your shared space a name before continuing.');
      return;
    }

    setLoading(true);
    try {
      const rel = await api.createRelationship(user.id, trimmed, {
        anniversaryDate,
        relationshipType,
      });
      await markRelationshipOnboardingDone(user.id);
      setRelationship(rel);
      setInviteCode(rel.invite_code);
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not create relationship');
    } finally {
      setLoading(false);
    }
  };

  const shareInvite = async () => {
    if (!inviteCode) return;
    await Share.share({
      message: `Join me on Moments! Use invite code: ${inviteCode}\n\nMoments is our private relationship space.`,
    });
  };

  const copyCode = async () => {
    if (!inviteCode) return;
    await Clipboard.setStringAsync(inviteCode);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Copied!', 'Invite code copied to clipboard');
  };

  const continueWithoutInvite = () => {
    Haptics.selectionAsync();
    router.replace({
      pathname: '/(onboarding)/notification-prompt',
      params: { next: 'home' },
    });
  };

  const goBack = () => goToOnboardingBack(router, 'create-relationship', parsed);

  return (
    <OnboardingChrome stepId="create-relationship" onBack={goBack}>
      <View
        style={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.lg, paddingHorizontal: Spacing.lg },
        ]}>
        {!inviteCode ? (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Create your relationship</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Pick a name for your shared space and invite your partner.
            </Text>

            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Space name</Text>
            <TextInput
              style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Our Moments"
              placeholderTextColor={colors.textTertiary}
              autoCorrect={false}
            />

            <PrimaryButton label={loading ? 'Creating…' : 'Create Relationship'} onPress={create} loading={loading} style={styles.btn} />
            <PromptLink
              prompt="Have an invite code?"
              linkLabel="Join instead"
              href={{
                pathname: '/(onboarding)/join-relationship',
                params: buildOnboardingRelationshipParams({
                  ...parsed,
                  spacePathChosen: 'join',
                }),
              }}
            />
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.text }]}>Invite your partner</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Share this code so they can join your space
            </Text>
            <Pressable onPress={copyCode} style={[styles.codeBox, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
              <Text style={[styles.code, { color: colors.text }]}>{inviteCode}</Text>
              <Text style={[styles.tapCopy, { color: colors.textSecondary }]}>Tap to copy</Text>
            </Pressable>
            <PrimaryButton label="Share Invite" onPress={shareInvite} style={styles.btn} />

            <View style={styles.laterWrap}>
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                <Text style={[styles.dividerText, { color: colors.textTertiary }]}>or</Text>
                <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
              </View>

              <Pressable
                onPress={continueWithoutInvite}
                style={({ pressed }) => [
                  styles.laterBtn,
                  {
                    backgroundColor: pressed ? colors.accentSoft : colors.surfaceElevated,
                    borderColor: pressed ? colorWithAlpha(colors.accent, 0.28) : colors.border,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Continue without inviting your partner">
                <View style={styles.laterContent}>
                  <View style={styles.laterCopy}>
                    <Text style={[styles.laterTitle, { color: colors.text }]}>Continue to app</Text>
                    <Text style={[styles.laterSubtitle, { color: colors.textTertiary }]}>
                      I&apos;ll invite my partner later
                    </Text>
                  </View>
                  <View style={[styles.laterChevron, { backgroundColor: colors.accentMuted }]}>
                    <Icon name="chevronRight" size={18} color={colors.accent} strokeWidth={2.2} />
                  </View>
                </View>
              </Pressable>

              <Text style={[styles.laterHint, { color: colors.textTertiary }]}>
                Your code stays in Profile
              </Text>
            </View>
          </>
        )}
      </View>
    </OnboardingChrome>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', width: '100%' },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5, width: '100%' },
  subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 22, marginTop: 10, marginBottom: 8, maxWidth: 320 },
  inputLabel: { fontSize: 13, fontWeight: '700', width: '100%', marginTop: 28, marginBottom: 8, letterSpacing: 0.2 },
  input: { borderWidth: 1, borderRadius: 14, padding: 16, fontSize: 18, width: '100%', textAlign: 'center' },
  btn: { width: '100%', marginTop: 16 },
  laterWrap: { width: '100%', marginTop: 28, alignItems: 'center' },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
    width: '100%',
  },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 12, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
  laterBtn: {
    width: '100%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  laterContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  laterCopy: { flex: 1 },
  laterTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  laterSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  laterChevron: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterHint: { fontSize: 12, marginTop: 12, textAlign: 'center' },
  codeBox: { padding: 24, borderRadius: 16, borderWidth: 2, alignItems: 'center', marginTop: 28, width: '100%' },
  code: { fontSize: 36, fontWeight: '800', letterSpacing: 8 },
  tapCopy: { fontSize: 13, marginTop: 8 },
});
