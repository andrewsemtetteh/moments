import * as Haptics from '@/lib/haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { firstName } from '@/components/games/room-ui';
import { PromptStatus, TodaysPromptCard } from '@/components/home/TodaysPromptCard';
import { Icon } from '@/components/ui/Icon';
import { useCardBorder } from '@/hooks/useCardBorder';
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
  const cardBorder = useCardBorder();
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
    return <TodaysPromptCard challenge={challenge} onOpenHistory={onOpenHistory} startComposing={answering} />;
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
    <View style={[styles.card, { backgroundColor: colors.tints.butter }, cardBorder]}>
      <View style={styles.head}>
        <Text style={[styles.title, { color: colors.textSecondary }]}>Today’s question</Text>
        <Pressable
          onPress={onOpenHistory}
          hitSlop={10}
          style={styles.historyBtn}
          accessibilityRole="button"
          accessibilityLabel="Past questions">
          <Icon name="time" size={22} color={colors.tintAccents?.butter ?? colors.text} />
        </Pressable>
      </View>

      <Text style={[styles.prompt, { color: colors.text }]}>{challenge?.prompt ?? PREVIEW_QUESTION}</Text>

      {challenge ? (
        <PromptStatus challenge={challenge} />
      ) : (
        <Text style={[styles.status, { color: colors.textSecondary }]} numberOfLines={2}>
          {status}
        </Text>
      )}

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
  // Same as TodaysPromptCard (and Home's other cards: 14pt grey label, 22 radius, 16 padding).
  card: { borderRadius: 22, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: '800' },
  historyBtn: { width: 36, height: 36, marginRight: -8, marginVertical: -8, alignItems: 'center', justifyContent: 'center' },
  prompt: { fontSize: 19, fontWeight: '800', lineHeight: 25, letterSpacing: -0.3 },
  status: { flex: 1, fontSize: 13, fontWeight: '600', lineHeight: 18 },
  answer: { height: 50, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  answerText: { fontSize: 16, fontWeight: '800' },
});
