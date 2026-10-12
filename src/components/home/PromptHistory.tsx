import { format, formatDistanceToNowStrict, isYesterday, parseISO, startOfDay } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/layout/ScreenHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { Avatar } from '@/components/ui/primitives';
import { useDailyChallengeHistory } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import {
  isPromptComplete,
  myPromptResponse,
  partnerPromptResponse,
  promptAuthorLabel,
  promptHistoryStatus,
} from '@/lib/daily-prompt';
import { closeStackScreen } from '@/lib/router';
import { useAuthStore, useRelationshipStore } from '@/stores';

function historyDateLabel(dateStr: string): string {
  try {
    const date = startOfDay(parseISO(dateStr));
    const today = startOfDay(new Date());
    if (date.getTime() === today.getTime()) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return formatDistanceToNowStrict(date, { addSuffix: true });
  } catch {
    return dateStr;
  }
}

/** Past questions: a pushed screen with the native swipe back, like Notifications. */
export function PromptHistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const { data: entries = [], isLoading } = useDailyChallengeHistory();
  const partnerFirst = getFirstName(partner?.name) ?? 'Your partner';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Past questions" onBack={() => closeStackScreen(router)} />

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : entries.length === 0 ? (
        <EmptyState
          fill
          icon="time"
          title="No past questions yet"
          text="Answer today’s question together and it will show up here, with both your answers."
          style={{ paddingBottom: insets.bottom + 60 }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}>
          {entries.map((entry) => {
            const complete = isPromptComplete(entry);
            return (
              <Pressable
                key={entry.id}
                onPress={() => router.push({ pathname: '/question-history/[id]', params: { id: entry.id } })}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: complete ? (pressed ? 0.9 : 1) : 0.65,
                  },
                ]}>
                <Text style={[styles.date, { color: colors.textTertiary }]}>{historyDateLabel(entry.challenge_date)}</Text>
                <Text style={[styles.prompt, { color: complete ? colors.text : colors.textSecondary }]} numberOfLines={2}>
                  {entry.prompt}
                </Text>
                <Text style={[styles.badge, { color: colors.textSecondary }]}>
                  {promptHistoryStatus(entry, user?.id, relationship, partnerFirst)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

/** One past question with both answers. */
export function PromptHistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const { data: entries = [], isLoading } = useDailyChallengeHistory();
  const entry = entries.find((e) => e.id === id);
  const partnerFirst = getFirstName(partner?.name) ?? 'Your partner';

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScreenHeader
        title={entry ? format(parseISO(entry.challenge_date), 'MMM d, yyyy') : 'Question'}
        onBack={() => router.back()}
      />
      {!entry ? (
        isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <EmptyState fill icon="question" title="Question not found" text="It may be from before you two linked up." />
        )
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 16 }]}
          showsVerticalScrollIndicator={false}>
          <Text style={[styles.detailPrompt, { color: colors.text }]}>{entry.prompt}</Text>
          {isPromptComplete(entry) ? (
            <View style={styles.detailAnswers}>
              <AnswerBubble
                label="You"
                text={myPromptResponse(entry, user?.id, relationship) ?? ''}
                avatarName={user?.name}
                avatarUrl={user?.avatar_url}
                mine
              />
              <AnswerBubble
                label={promptAuthorLabel(false, user, partner)}
                text={partnerPromptResponse(entry, user?.id, relationship) ?? ''}
                avatarName={partner?.name}
                avatarUrl={partner?.avatar_url}
              />
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              {promptHistoryStatus(entry, user?.id, relationship, partnerFirst)}
            </Text>
          )}
        </ScrollView>
      )}
    </View>
  );
}

function AnswerBubble({
  label,
  text,
  avatarName,
  avatarUrl,
  mine,
}: {
  label: string;
  text: string;
  avatarName?: string | null;
  avatarUrl?: string | null;
  mine?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.bubble,
        { backgroundColor: mine ? colors.accentSoft : colors.surfaceElevated, borderColor: colors.border },
      ]}>
      <View style={styles.bubbleHead}>
        <Avatar name={avatarName} imageUrl={avatarUrl} size={24} />
        <Text style={[styles.bubbleLabel, { color: colors.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.bubbleText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, fontWeight: '500', lineHeight: 21, textAlign: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  row: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6 },
  date: { fontSize: 13, fontWeight: '600' },
  prompt: { fontSize: 17, fontWeight: '800', lineHeight: 24, letterSpacing: -0.2 },
  badge: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  detailPrompt: {
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 30,
    letterSpacing: -0.4,
    marginBottom: 8,
    textAlign: 'center',
  },
  detailAnswers: { gap: 12 },
  bubble: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
  bubbleHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bubbleLabel: { flex: 1, fontSize: 13, fontWeight: '700' },
  bubbleText: { fontSize: 15, lineHeight: 22 },
});
