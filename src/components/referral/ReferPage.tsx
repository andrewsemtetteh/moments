import { useAuth } from '@clerk/expo';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from '@/lib/haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { TwoCouplesCharacters } from '@/components/onboarding/Characters';
import { Icon } from '@/components/ui/Icon';
import { referralLink } from '@/constants/links';
import { REFERRAL_DAYS } from '@/constants/subscription';
import { useTheme } from '@/hooks/useTheme';
import { getMyReferral } from '@/lib/moments-api';
import { useAuthStore } from '@/stores';

const STEPS = [
  'Share your link with a couple you know',
  'They sign up and pair with each other',
  `You both get ${REFERRAL_DAYS} days of Plus, automatically`,
];

/**
 * Invite another couple: both couples get REFERRAL_DAYS (14) days of Plus once
 * the invited couple pairs (granted server-side with billing). Reached from
 * the paywall, Settings and the You page, so people who skip the trial can
 * still earn Plus. Swipe back or the arrow to return.
 */
export function ReferPage({ onBack }: { onBack?: () => void } = {}) {
  const router = useRouter();
  // Its own route goes back; over the paywall, it slides away to the paywall.
  const back = onBack ?? (() => router.back());
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const { getToken } = useAuth();
  // Your own referral code (made by the server on first visit).
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await getMyReferral(token);
        if (!cancelled) setCode(res.code);
      } catch {
        // Offline: the link fills in next time.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, getToken]);
  // No account in the dev walkthrough: show a sample link.
  const shownCode = code ?? (user ? null : 'SAMPLE7');
  const fullLink = shownCode ? referralLink(shownCode) : '';
  const link = shownCode ? fullLink.replace(/^https:\/\//, '') : 'Getting your link…';
  const [copied, setCopied] = useState(false);
  // Copying counts as sharing: they'll paste it themselves, so the button moves them on.
  const [copiedOnce, setCopiedOnce] = useState(false);
  const [sent, setSent] = useState(false);
  // Once the link is out (shared or copied), the button becomes Continue, as on the invite step.
  const ready = sent || copiedOnce;

  // "Copied" shows for a moment, then the box goes back to "Copy".
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1800);
    return () => clearTimeout(t);
  }, [copied]);

  const share = async () => {
    if (!fullLink) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await Share.share({
      message: `We use Moments to stay close every day. Join with our link and we both get ${REFERRAL_DAYS} days of Plus free: ${fullLink}`,
    });
    if (result.action === Share.sharedAction) setSent(true);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]} edges={['top', 'left', 'right']}>
      <View style={styles.top}>
        <Pressable onPress={back} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
          <Icon name="chevronLeft" size={28} color={colors.text} />
        </Pressable>
      </View>
      <View style={styles.body}>
        <View style={styles.art}>
          <TwoCouplesCharacters width={290} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Share the love, get {REFERRAL_DAYS} days free</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Know a couple who’d love Moments? When they sign up and pair, you both get {REFERRAL_DAYS} days of Plus.
        </Text>

        <View style={[styles.list, { borderColor: colors.text, backgroundColor: colors.surface }]}>
          {STEPS.map((t, i) => (
            <View
              key={t}
              style={[styles.row, i < STEPS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
              <View style={[styles.num, { backgroundColor: colors.text }]}>
                <Text style={[styles.numText, { color: colors.background }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.rowText, { color: colors.text }]}>{t}</Text>
            </View>
          ))}
        </View>

        <Pressable
          onPress={() => {
            if (!fullLink) return;
            void Clipboard.setStringAsync(fullLink);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCopied(true);
            setCopiedOnce(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={copied ? 'Link copied' : 'Copy your link'}
          style={[styles.linkBox, { backgroundColor: colors.boldBorder ? colors.backgroundElevated : colors.surfaceElevated }]}>
          <Text style={[styles.link, { color: colors.text }]} numberOfLines={1}>
            {link}
          </Text>
          {copied ? (
            <Animated.View key="copied" entering={FadeIn.duration(150)} style={styles.copiedRow}>
              <Icon name="check" size={14} color={colors.success} />
              <Text style={[styles.copy, { color: colors.success }]}>Copied</Text>
            </Animated.View>
          ) : (
            <Text style={[styles.copy, { color: colors.text }]}>Copy</Text>
          )}
        </Pressable>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={ready ? back : () => void share()}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cta, { backgroundColor: colors.accent, opacity: pressed ? 0.85 : 1 }]}>
          {ready ? null : <Icon name="share" size={18} color={colors.onAccent} />}
          <Text style={[styles.ctaText, { color: colors.onAccent }]}>{ready ? 'Continue' : 'Share my link'}</Text>
        </Pressable>
        <Text style={[styles.note, { color: colors.textTertiary }]}>Your {REFERRAL_DAYS} free days start when they join.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { paddingHorizontal: 14, paddingTop: 6 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, paddingHorizontal: 24, gap: 14 },
  art: { alignItems: 'center' },
  title: { fontSize: 30, fontWeight: '900', letterSpacing: -0.7, lineHeight: 34, textAlign: 'center' },
  sub: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
  list: { borderWidth: 2, borderRadius: 22, overflow: 'hidden', marginTop: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 14 },
  num: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 13, fontWeight: '900' },
  rowText: { flex: 1, fontSize: 14, fontWeight: '700' },
  linkBox: { borderRadius: 16, paddingHorizontal: 14, height: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  copiedRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  link: { flex: 1, fontSize: 15, fontWeight: '900' },
  copy: { fontSize: 13, fontWeight: '800' },
  footer: { paddingHorizontal: 24, paddingTop: 10, gap: 8 },
  cta: { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  ctaText: { fontSize: 17, fontWeight: '800' },
  note: { fontSize: 12, textAlign: 'center' },
});
