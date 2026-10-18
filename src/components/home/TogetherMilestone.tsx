import * as Haptics from '@/lib/haptics';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { StickerHeart } from '@/components/home/StickerHeart';
import { ShareCardModal } from '@/components/share/ShareCardModal';
import { TogetherShareCard } from '@/components/share/TogetherShareCard';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { ThemedStatusBar } from '@/components/ui/ThemedStatusBar';
import { useStreak } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { togetherStreakCount } from '@/lib/streak';
import {
  hasSeenTogetherMilestone,
  isTogetherMilestone,
  markTogetherMilestoneSeen,
  togetherMilestoneHeadline,
} from '@/lib/together-milestones';
import { isFullScreenLayerOpen, useAuthStore, useRelationshipStore, useUIStore } from '@/stores';

const OPEN_DELAY_MS = 1200;

/**
 * Watches the together streak (days in a row you both checked in) and opens its
 * celebration at 7, 30, 100, 365 days — once per milestone, on each of your phones.
 * Waits while another celebration or the paywall is up.
 */
export function TogetherMilestoneSync() {
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const { data: streak } = useStreak();
  const open = useUIStore((s) => s.openTogetherMilestone);
  const busy = useUIStore(isFullScreenLayerOpen);
  const checked = useRef<number | null>(null);
  const count = togetherStreakCount(streak);
  // Only once the server reports the together streak on its own (older servers don't).
  const known = streak?.together_streak != null;

  useEffect(() => {
    if (!relationshipId || !known || count <= 0 || busy) return;
    if (!isTogetherMilestone(count) || checked.current === count) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        const seen = await hasSeenTogetherMilestone(relationshipId, count);
        checked.current = count;
        if (cancelled || seen) return;
        open(count);
      })();
    }, OPEN_DELAY_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [relationshipId, known, count, busy, open]);

  return null;
}

/** The together milestone celebration: the sticker heart, both of you, the count, and a shareable card. */
export function TogetherMilestoneModal() {
  const count = useUIStore((s) => s.togetherMilestoneCount);
  const close = useUIStore((s) => s.closeTogetherMilestone);
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);

  useEffect(() => {
    if (count && relationshipId) void markTogetherMilestoneSeen(relationshipId, count);
  }, [count, relationshipId]);

  if (count == null || count <= 0) return null;
  return <TogetherCelebration key={count} count={count} onClose={close} />;
}

function TogetherCelebration({ count, onClose }: { count: number; onClose: () => void }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const them = getFirstName(partner?.name) ?? 'your person';
  const [sharing, setSharing] = useState(false);

  // The heart pops in: small, overshoot, settle.
  const pop = useSharedValue(reduceMotion ? 1 : 0.2);
  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (reduceMotion) return;
    pop.value = withDelay(
      120,
      withSequence(
        withTiming(1.16, { duration: 380, easing: Easing.out(Easing.cubic) }),
        withTiming(0.95, { duration: 170 }),
        withTiming(1, { duration: 160 }),
      ),
    );
    // Plays once per celebration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const heartStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const enter = (delay: number) => (reduceMotion ? undefined : FadeInUp.delay(delay).duration(400));

  const done = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Modal visible animationType="fade" onRequestClose={done} statusBarTranslucent presentationStyle="fullScreen">
      <ThemedStatusBar />
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <SafeAreaView style={styles.content} edges={['top', 'bottom']}>
          <View style={styles.main}>
            <Animated.View style={heartStyle}>
              <StickerHeart size={150} />
            </Animated.View>
            <Animated.View entering={enter(420)} style={styles.couple}>
              <View style={[styles.ring, { borderColor: colors.background }]}>
                <Avatar name={user?.name} imageUrl={user?.avatar_url} size={44} />
              </View>
              <View style={[styles.ring, styles.overlap, { borderColor: colors.background }]}>
                <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={44} />
              </View>
            </Animated.View>
            <Animated.Text entering={enter(560)} style={[styles.number, { color: colors.text }]}>
              {count.toLocaleString()}
            </Animated.Text>
            <Animated.Text
              entering={enter(640)}
              style={[styles.title, { color: colors.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit>
              {togetherMilestoneHeadline(count)}
            </Animated.Text>
            <Animated.Text entering={enter(760)} style={[styles.message, { color: colors.textSecondary }]}>
              {`You and ${them} checked in ${count} days in a row. That’s showing up for each other.`}
            </Animated.Text>
          </View>

          <Animated.View entering={enter(900)} style={styles.actions}>
            <Pressable
              onPress={done}
              accessibilityRole="button"
              style={({ pressed }) => [styles.cta, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
              <Text style={[styles.ctaText, { color: colors.onAccent }]}>Continue</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSharing(true);
              }}
              accessibilityRole="button"
              hitSlop={6}
              style={({ pressed }) => [styles.share, pressed && styles.pressed]}>
              <Icon name="share" size={18} color={colors.text} />
              <Text style={[styles.shareText, { color: colors.text }]}>Share achievement</Text>
            </Pressable>
          </Animated.View>
        </SafeAreaView>

        {/* Inside this popup, so it sits on top of the celebration. */}
        <ShareCardModal visible={sharing} onClose={() => setSharing(false)} title="Share your together milestone" inline>
          <TogetherShareCard count={count} />
        </ShareCardModal>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24 },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  couple: { flexDirection: 'row', marginTop: 4 },
  ring: { borderWidth: 3, borderRadius: 999 },
  overlap: { marginLeft: -12 },
  number: { fontSize: 72, fontWeight: '900', letterSpacing: -2.5, lineHeight: 78, marginTop: 4 },
  title: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, marginTop: -6 },
  message: { fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 6 },
  actions: { gap: 6, paddingBottom: 8 },
  cta: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  ctaText: { fontSize: 17, fontWeight: '800' },
  share: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  shareText: { fontSize: 16, fontWeight: '800' },
  pressed: { opacity: 0.8 },
});
