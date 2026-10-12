import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { firstName } from '@/components/games/room-ui';
import { TodaysPromptCard } from '@/components/home/TodaysPromptCard';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { partnerPromptResponse, promptPhase } from '@/lib/daily-prompt';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { DailyChallenge } from '@/types/database';

/**
 * TEMPORARY: shown in place of today's question while the real one can't be loaded, so the card
 * can be previewed. Tapping Answer on it retries the real question. Remove once loading is fixed.
 */
const PREVIEW_QUESTION = 'What’s one small thing I did this week that made you feel loved?';

interface ActivitiesIntroSectionProps {
  challenge?: DailyChallenge | null;
  loading?: boolean;
  onRetry?: () => void;
  onOpenHistory: () => void;
}

/**
 * Today's Question, always at the top of Play. Answering expands to the same
 * TodaysPromptCard used on Home (no modal).
 */
export function ActivitiesIntroSection({ challenge, loading, onRetry, onOpenHistory }: ActivitiesIntroSectionProps) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const [answering, setAnswering] = useState(false);

  const phase = challenge ? promptPhase(challenge, user?.id, relationship) : null;
  // Full card when answering, or when there's nothing left to "Answer" (waiting / reveal).
  const showFullCard = !!challenge && (answering || phase === 'waiting' || phase === 'reveal');

  // Tabs stay mounted: collapse an unanswered form whenever Play loses focus.
  useFocusEffect(
    useCallback(() => {
      return () => setAnswering(false);
    }, []),
  );

  if (challenge && showFullCard) {
    return <TodaysPromptCard challenge={challenge} onOpenHistory={onOpenHistory} />;
  }

  const partnerAnswered = !!challenge && !!partnerPromptResponse(challenge, user?.id, relationship);
  const partnerName = firstName(partner?.name);
  const status = !partner
    ? 'Your partner sees it once they join.'
    : partnerAnswered
      ? `${partnerName} answered. Answer to see theirs.`
      : `Answer first and ${partnerName} gets a nudge.`;

  const answer = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (challenge) setAnswering(true);
    else onRetry?.();
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceElevated,
          borderColor: colors.border,
          borderWidth: colors.boldBorder ? 2 : StyleSheet.hairlineWidth,
        },
      ]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.text }]}>Today’s Question</Text>
        <Pressable onPress={onOpenHistory} hitSlop={10} accessibilityRole="button" accessibilityLabel="Past questions">
          <Icon name="time" size={22} color={colors.accent} />
        </Pressable>
      </View>

      <Text style={[styles.prompt, { color: colors.text }]}>{challenge?.prompt ?? PREVIEW_QUESTION}</Text>

      <View style={[styles.statusRow, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <View style={styles.avatars}>
          <View style={[styles.avatarRing, { borderColor: colors.background }]}>
            <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={28} />
          </View>
          <View style={[styles.slot, { borderColor: colors.textTertiary, backgroundColor: colors.background }]} />
        </View>
        <Text style={[styles.status, { color: colors.textSecondary }]} numberOfLines={2}>
          {status}
        </Text>
      </View>

      <Pressable
        onPress={answer}
        disabled={!challenge && loading}
        accessibilityRole="button"
        accessibilityLabel="Answer today's question"
        style={({ pressed }) => [styles.answer, { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 }]}>
        {!challenge && loading ? (
          <ActivityIndicator size="small" color={colors.onAccent} />
        ) : (
          <Text style={[styles.answerText, { color: colors.onAccent }]}>Answer</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 18, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4 },
  prompt: { fontSize: 17, fontWeight: '600', lineHeight: 24 },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  avatars: { flexDirection: 'row', alignItems: 'center' },
  avatarRing: { borderRadius: 16, borderWidth: 2 },
  slot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderStyle: 'dashed', marginLeft: -9 },
  status: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  answer: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  answerText: { fontSize: 16, fontWeight: '800' },
});
