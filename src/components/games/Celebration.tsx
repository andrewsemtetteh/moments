import * as Haptics from '@/lib/haptics';
import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  FadeOutUp,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ShareCardModal } from '@/components/share/ShareCardModal';
import { Icon } from '@/components/ui/Icon';
import { TrophyShareCard } from '@/components/share/TrophyShareCard';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { encodeAttachment } from '@/lib/chat-attachments';
import { notifyIsland } from '@/lib/in-app-notify';
import type { BadgeDef } from '@/lib/play-progress';
import { sendMessage, sendPartnerNotification } from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { useGameRoomStore } from '@/stores/game-room-store';
import { usePlayProgressStore, type Celebration } from '@/stores/play-progress-store';

type BadgeCelebration = Extract<Celebration, { kind: 'badge' }>;
type QuestCelebration = Extract<Celebration, { kind: 'quest' }>;

const CONFETTI_COLORS = ['#FF6B8A', '#FFD54A', '#5B8DEF', '#3DBE7A', '#B48CFF', '#FF9F5A'];

/** A fixed 0–1 "random" per piece and property: scattered like Math.random, but pure. */
function scatter(index: number, salt: number): number {
  const x = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function Piece({ index, count }: { index: number; count: number }) {
  const t = useSharedValue(0);
  const spec = useMemo(() => {
    const angle = (index / count) * Math.PI * 2 + scatter(index, 1) * 0.6;
    const speed = 160 + scatter(index, 2) * 260;
    return {
      color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed - 140,
      spin: (scatter(index, 3) - 0.5) * 900,
      size: 7 + scatter(index, 4) * 7,
      delay: scatter(index, 5) * 120,
      round: scatter(index, 6) > 0.5,
    };
  }, [index, count]);

  useEffect(() => {
    t.value = withDelay(spec.delay, withTiming(1, { duration: 1700, easing: Easing.out(Easing.quad) }));
  }, [t, spec.delay]);

  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.7 ? 1 : (1 - t.value) / 0.3,
    transform: [
      { translateX: spec.dx * t.value },
      { translateY: spec.dy * t.value + 380 * t.value * t.value },
      { rotate: `${spec.spin * t.value}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          backgroundColor: spec.color,
          width: spec.size,
          height: spec.round ? spec.size : spec.size * 1.8,
          borderRadius: spec.round ? spec.size / 2 : 2,
        },
        style,
      ]}
    />
  );
}

/** One-shot burst of confetti from the middle of the screen. Remount (change `burstKey`) to replay. */
export const Confetti = memo(function Confetti({ count = 46, burstKey = 0 }: { count?: number; burstKey?: number }) {
  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [burstKey]);
  return (
    <View pointerEvents="none" style={styles.confettiRoot} key={burstKey}>
      {Array.from({ length: count }).map((_, i) => (
        <Piece key={i} index={i} count={count} />
      ))}
    </View>
  );
});

const AUTO_DISMISS_MS = 3400;

function Toast({ item }: { item: Celebration }) {
  const { colors } = useTheme();
  const dismiss = usePlayProgressStore((s) => s.dismissCelebration);

  useEffect(() => {
    const id = setTimeout(() => dismiss(item.id), item.kind === 'xp' ? 2200 : AUTO_DISMISS_MS);
    return () => clearTimeout(id);
  }, [item, dismiss]);

  const { emoji, title, sub } = useMemo(() => {
    switch (item.kind) {
      case 'xp':
        return { emoji: '⭐', title: `+${item.amount} XP`, sub: item.label };
      case 'quest':
        return { emoji: item.quest.emoji, title: 'Quest complete!', sub: `${item.quest.title} · +${item.quest.reward} XP` };
      case 'badge':
        return { emoji: item.badge.emoji, title: `Trophy: ${item.badge.title}`, sub: item.badge.hint };
      case 'level':
        return { emoji: '🎉', title: `Level ${item.level}!`, sub: item.title };
    }
  }, [item]);

  return (
    <Animated.View
      entering={FadeInUp.springify().damping(14)}
      exiting={FadeOutUp.duration(200)}
      style={[
        styles.toast,
        { backgroundColor: colors.surfaceElevated, borderColor: item.kind === 'xp' ? colors.border : colors.accent },
      ]}>
      <Text style={styles.toastEmoji}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={[styles.toastTitle, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[styles.toastSub, { color: colors.textSecondary }]} numberOfLines={1}>
          {sub}
        </Text>
      </View>
    </Animated.View>
  );
}

function LevelUp({ item }: { item: Extract<Celebration, { kind: 'level' }> }) {
  const { colors } = useTheme();
  const dismiss = usePlayProgressStore((s) => s.dismissCelebration);
  useEffect(() => {
    const id = setTimeout(() => dismiss(item.id), 4200);
    return () => clearTimeout(id);
  }, [item, dismiss]);

  return (
    <Pressable style={styles.levelRoot} onPress={() => dismiss(item.id)} accessibilityLabel="Dismiss level up">
      <Confetti burstKey={item.level} />
      <Animated.View
        entering={ZoomIn.springify().damping(11)}
        style={[styles.levelCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.accent }]}>
        <Text style={styles.levelEmoji}>🏅</Text>
        <Text style={[styles.levelKicker, { color: colors.accent }]}>LEVEL UP</Text>
        <Text style={[styles.levelNumber, { color: colors.text }]}>{item.level}</Text>
        <Text style={[styles.levelTitle, { color: colors.textSecondary }]}>{item.title}</Text>
      </Animated.View>
    </Pressable>
  );
}

/** A trophy just unlocked: the achievement card, with confetti and a way to share it. */
function TrophyUnlocked({ item, onShare }: { item: BadgeCelebration; onShare?: (badge: BadgeDef) => void }) {
  const { colors } = useTheme();
  const dismiss = usePlayProgressStore((s) => s.dismissCelebration);
  const partner = useRelationshipStore((s) => s.partner);
  const fromPartner = item.origin === 'partner';

  return (
    <Pressable style={styles.levelRoot} onPress={() => dismiss(item.id)} accessibilityLabel="Dismiss trophy">
      <Confetti burstKey={item.badge.goal} />
      <Animated.View
        entering={ZoomIn.springify().damping(11)}
        style={[styles.trophyCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.accent }]}>
        <Text style={[styles.levelKicker, { color: colors.accent }]}>TROPHY UNLOCKED</Text>
        <View style={[styles.trophyMedal, { backgroundColor: colors.accentSoft, borderColor: colors.accent }]}>
          <Icon name={item.badge.icon} size={52} color={colors.accent} filled />
        </View>
        <Text style={[styles.trophyTitle, { color: colors.text }]}>{item.badge.title}</Text>
        <Text style={[styles.trophyHint, { color: colors.textSecondary }]}>
          {fromPartner
            ? `${getFirstName(partner?.name) ?? 'Your partner'} unlocked this for you both · ${item.badge.hint}`
            : item.badge.hint}
        </Text>
        <Text style={[styles.trophyGroup, { color: colors.textTertiary }]}>
          {item.badge.group} · Step {item.badge.tier}
        </Text>
        <View style={styles.trophyActions}>
          {onShare ? (
            <Pressable
              onPress={() => {
                dismiss(item.id);
                onShare(item.badge);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.trophyBtn,
                { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}>
              <Text style={[styles.trophyBtnText, { color: colors.text }]}>Share</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => dismiss(item.id)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.trophyBtn,
              { backgroundColor: colors.accent, borderColor: colors.accent, opacity: pressed ? 0.85 : 1 },
            ]}>
            <Text style={[styles.trophyBtnText, { color: colors.onAccent }]}>Nice!</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const relayed = new Set<string>();

/** Tell your partner and post the card to your chat: something this phone just earned. */
async function shareWithPartner(item: QuestCelebration | BadgeCelebration) {
  const { relationship, partner } = useRelationshipStore.getState();
  const user = useAuthStore.getState().user;
  if (!relationship?.id || !user) return;
  const me = getFirstName(user.name) ?? 'Your partner';
  const quest = item.kind === 'quest';
  const attachment = quest
    ? {
        type: 'achievement' as const,
        kind: 'quest' as const,
        id: item.quest.id,
        emoji: item.quest.emoji,
        title: item.quest.title,
        sub: `Today’s quest done · +${item.quest.reward} XP for you both`,
      }
    : {
        type: 'achievement' as const,
        kind: 'trophy' as const,
        id: item.badge.id,
        emoji: item.badge.emoji,
        title: item.badge.title,
        sub: item.badge.hint,
      };
  await Promise.allSettled([
    sendMessage(relationship.id, user.id, encodeAttachment(attachment)),
    partner
      ? sendPartnerNotification(
          relationship.id,
          partner.id,
          'achievement',
          quest
            ? `${me} finished today’s quest “${item.quest.title}” (+${item.quest.reward} XP) ${item.quest.emoji}`
            : `${me} unlocked the “${item.badge.title}” trophy for you both ${item.badge.emoji}`,
          // Tapping the notification opens this trophy (quests open Play, where they live).
          quest ? undefined : { relatedId: item.badge.id },
        )
      : Promise.resolve(),
  ]);
}

/**
 * Mounted once at the root. A finished quest pops the Dynamic Island (yours or your
 * partner's); whatever this phone earned is also sent to your partner as a notification
 * and posted to your chat. Trophies get the full achievement card from CelebrationHost.
 */
export function AchievementRelay() {
  const queue = usePlayProgressStore((s) => s.celebrations);
  const dismiss = usePlayProgressStore((s) => s.dismissCelebration);
  const partnerName = useRelationshipStore((s) => s.partner?.name);

  useEffect(() => {
    for (const item of queue) {
      if (item.kind !== 'quest' && item.kind !== 'badge') continue;
      if (relayed.has(item.id)) continue;
      relayed.add(item.id);
      if (item.origin === 'self') void shareWithPartner(item);
      if (item.kind === 'quest') {
        notifyIsland({
          id: `quest:${item.id}`,
          title: item.origin === 'partner' ? `${getFirstName(partnerName) ?? 'Your partner'} finished a quest` : 'Quest complete!',
          message: `${item.quest.title} · +${item.quest.reward} XP`,
          icon: item.quest.icon,
          target: { type: 'achievement' },
        });
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        dismiss(item.id);
      }
    }
  }, [queue, dismiss, partnerName]);

  return null;
}

/**
 * Shows XP / quest / badge toasts and the level-up card from the shared celebration queue.
 * Rendered in one place at a time: inside the live room while it's open (so it can't be hidden
 * under the room's native modal), otherwise at the app root.
 */
export function CelebrationHost({ surface }: { surface: 'root' | 'room' }) {
  const roomOpen = useGameRoomStore((s) => s.open);
  const queue = usePlayProgressStore((s) => s.celebrations);
  const insets = useSafeAreaInsets();
  const [sharing, setSharing] = useState<BadgeDef | null>(null);
  if ((surface === 'root') === roomOpen) return null;

  const level = queue.find((c): c is Extract<Celebration, { kind: 'level' }> => c.kind === 'level');
  // Level-up first, then each new trophy in turn.
  const trophy = level ? undefined : queue.find((c): c is BadgeCelebration => c.kind === 'badge');
  const toasts = queue.filter((c) => c.kind === 'xp').slice(0, 3);

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="none" style={[styles.toastStack, { top: insets.top + 8 }]}>
        {toasts.map((item) => (
          <Toast key={item.id} item={item} />
        ))}
      </View>
      {level ? <LevelUp key={level.id} item={level} /> : null}
      {trophy ? (
        <TrophyUnlocked
          key={trophy.id}
          item={trophy}
          // Sharing opens its own sheet; inside a live room that sheet couldn't show.
          onShare={surface === 'root' ? (badge) => setTimeout(() => setSharing(badge), 250) : undefined}
        />
      ) : null}
      {surface === 'root' ? (
        <ShareCardModal visible={!!sharing} onClose={() => setSharing(null)} title="Share your trophy">
          {sharing ? <TrophyShareCard icon={sharing.icon} title={sharing.title} hint={sharing.hint} /> : null}
        </ShareCardModal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  confettiRoot: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  // Percentages of the screen, so the burst stays centred at any size.
  piece: { position: 'absolute', top: '34%', left: '50%' },
  toastStack: { position: 'absolute', top: 64, left: 16, right: 16, gap: 8 },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  toastEmoji: { fontSize: 28 },
  toastTitle: { fontSize: 16, fontWeight: '900' },
  toastSub: { fontSize: 12, fontWeight: '600', marginTop: 1 },
  levelRoot: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  levelCard: { borderRadius: 32, borderWidth: 2, paddingVertical: 28, paddingHorizontal: 44, alignItems: 'center', gap: 2 },
  levelEmoji: { fontSize: 54 },
  levelKicker: { fontSize: 13, fontWeight: '900', letterSpacing: 2 },
  levelNumber: { fontSize: 72, fontWeight: '900', lineHeight: 80 },
  levelTitle: { fontSize: 16, fontWeight: '800' },
  trophyCard: {
    width: '88%',
    maxWidth: 340,
    borderRadius: 32,
    borderWidth: 2,
    paddingVertical: 26,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 6,
  },
  trophyMedal: {
    width: 108,
    height: 108,
    borderRadius: 54,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  trophyTitle: { fontSize: 26, fontWeight: '900', textAlign: 'center', letterSpacing: -0.3 },
  trophyHint: { fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 21 },
  trophyGroup: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  trophyActions: { flexDirection: 'row', gap: 10, marginTop: 16, alignSelf: 'stretch' },
  trophyBtn: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trophyBtnText: { fontSize: 16, fontWeight: '900' },
});
