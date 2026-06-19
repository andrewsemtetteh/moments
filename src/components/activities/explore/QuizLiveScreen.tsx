import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { exploreStyles as s } from '@/components/activities/explore/explore-styles';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import {
  useActiveQuizLiveSession,
  useQuizLiveMutations,
  useRealtimeSubscription,
} from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import {
  BOOL_TILE_COLORS,
  QUIZ_TILE_COLORS,
  QUIZ_TOPIC_PRESETS,
  getRoundResponses,
} from '@/lib/quiz-live';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { QuizLiveQuestion } from '@/types/database';

export function QuizLiveScreen() {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const relationship = useRelationshipStore((s) => s.relationship);
  const { data: session, isLoading } = useActiveQuizLiveSession();
  const { start, submitAnswer, advance } = useQuizLiveMutations();
  const [topic, setTopic] = useState('');
  const [dismissedSessionId, setDismissedSessionId] = useState<string | null>(null);

  useRealtimeSubscription('quiz_live_sessions');

  const memberIds = useMemo(
    () => (relationship ? [relationship.user_1_id, relationship.user_2_id].filter(Boolean) as string[] : []),
    [relationship],
  );

  const partnerName = getFirstName(partner?.name) ?? 'Partner';
  const myName = getFirstName(user?.name) ?? 'You';

  const startGame = () => {
    const trimmed = topic.trim();
    if (!trimmed) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    start.mutate(trimmed);
  };

  if (isLoading && !session) {
    return (
      <View style={quizStyles.centered}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (session?.status === 'finished' && dismissedSessionId !== session.id) {
    const finalScores = session.scores ?? {};
    return (
      <View style={s.stack}>
        <LinearGradient colors={colors.gradient} style={quizStyles.heroEnd}>
          <Text style={quizStyles.heroEndEmoji}>🏆</Text>
          <Text style={quizStyles.heroEndTitle}>Game over</Text>
          <Text style={quizStyles.heroEndSub}>{session.topic}</Text>
          <View style={quizStyles.scoreboard}>
            {memberIds.map((id) => (
              <View key={id} style={quizStyles.scoreRow}>
                <Text style={quizStyles.scoreName}>{id === user?.id ? myName : partnerName}</Text>
                <Text style={quizStyles.scoreVal}>{finalScores[id] ?? 0}</Text>
              </View>
            ))}
          </View>
          <PrimaryButton
            label="Play again"
            onPress={() => {
              setDismissedSessionId(session.id);
              setTopic(session.topic);
            }}
          />
        </LinearGradient>
      </View>
    );
  }

  if (!session || (session.status === 'finished' && dismissedSessionId === session.id)) {
    return (
      <View style={s.stack}>
        <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={quizStyles.hero}>
          <Text style={quizStyles.heroEmoji}>🌐</Text>
          <Text style={quizStyles.heroTitle}>Quiz Live</Text>
          <Text style={quizStyles.heroSub}>
            Enter any topic and AI builds your round. You each play on your own phone.
          </Text>
        </LinearGradient>

        <TextInput
          style={[
            quizStyles.topicInput,
            { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
          placeholder="e.g. 90s movies, geography, about us…"
          placeholderTextColor={colors.textTertiary}
          value={topic}
          onChangeText={setTopic}
          multiline
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
          {QUIZ_TOPIC_PRESETS.map((preset) => (
            <Pressable
              key={preset}
              onPress={() => setTopic(preset)}
              style={[s.tab, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[s.tabText, { color: colors.textSecondary }]}>{preset}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <PrimaryButton
          label={start.isPending ? 'Building your quiz…' : 'Start live quiz'}
          onPress={startGame}
          loading={start.isPending}
          disabled={!topic.trim()}
        />
      </View>
    );
  }

  if (session.status === 'generating' || start.isPending) {
    return (
      <View style={[quizStyles.centered, s.stack]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={[quizStyles.waitingText, { color: colors.text }]}>Generating questions…</Text>
        <Text style={[quizStyles.waitingSub, { color: colors.textSecondary }]}>{session.topic}</Text>
      </View>
    );
  }

  const question = session.questions[session.current_index];
  const total = session.questions.length;
  const roundAnswers = getRoundResponses(session, session.current_index);
  const myAnswer = user ? roundAnswers[user.id] : undefined;
  const partnerAnswer = partner ? roundAnswers[partner.id] : undefined;
  const iAmHost = user?.id === session.host_user_id;

  if (!question) {
    return (
      <View style={quizStyles.centered}>
        <Text style={{ color: colors.textSecondary }}>No questions loaded.</Text>
      </View>
    );
  }

  if (session.round_phase === 'reveal') {
    return (
      <RevealPhase
        question={question}
        myAnswer={myAnswer}
        partnerAnswer={partnerAnswer}
        myName={myName}
        partnerName={partnerName}
        scores={session.scores}
        memberIds={memberIds}
        userId={user?.id}
        index={session.current_index}
        total={total}
        onNext={() => advance.mutate(session)}
        advancing={advance.isPending}
        isLast={session.current_index >= total - 1}
      />
    );
  }

  return (
    <AnswerPhase
      question={question}
      index={session.current_index}
      total={total}
      topic={session.topic}
      myAnswer={myAnswer}
      partnerAnswer={partnerAnswer}
      partnerName={partnerName}
      onPick={(idx) => {
        if (myAnswer !== undefined || !user) return;
        Haptics.selectionAsync();
        submitAnswer.mutate({ session, answerIndex: idx, memberIds });
      }}
      submitting={submitAnswer.isPending}
      waitingForPartner={myAnswer !== undefined && partnerAnswer === undefined && !!partner}
      hostLabel={iAmHost ? 'You started this round' : `${getFirstName(partner?.name) ?? 'Partner'} started this round`}
    />
  );
}

function AnswerPhase({
  question,
  index,
  total,
  topic,
  myAnswer,
  partnerAnswer,
  partnerName,
  onPick,
  submitting,
  waitingForPartner,
  hostLabel,
}: {
  question: QuizLiveQuestion;
  index: number;
  total: number;
  topic: string;
  myAnswer?: number;
  partnerAnswer?: number;
  partnerName: string;
  onPick: (idx: number) => void;
  submitting: boolean;
  waitingForPartner: boolean;
  hostLabel: string;
}) {
  const { colors } = useTheme();
  const tiles = question.type === 'boolean' ? 2 : 4;
  const palette = question.type === 'boolean' ? BOOL_TILE_COLORS : QUIZ_TILE_COLORS;

  return (
    <View style={s.stack}>
      <View style={quizStyles.roundMeta}>
        <Text style={[quizStyles.roundTopic, { color: colors.textSecondary }]}>{topic}</Text>
        <Text style={[quizStyles.roundCount, { color: colors.accent }]}>
          {index + 1} / {total}
        </Text>
      </View>
      <Text style={[quizStyles.hostHint, { color: colors.textTertiary }]}>{hostLabel}</Text>

      <View style={[quizStyles.questionCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Text style={[quizStyles.questionText, { color: colors.text }]}>{question.question}</Text>
      </View>

      <View style={[quizStyles.tileGrid, tiles === 2 && quizStyles.tileGridBool]}>
        {question.options.slice(0, tiles).map((label, idx) => {
          const picked = myAnswer === idx;
          const disabled = myAnswer !== undefined || submitting;
          return (
            <Pressable
              key={label}
              onPress={() => onPick(idx)}
              disabled={disabled}
              style={[
                quizStyles.tile,
                tiles === 2 && quizStyles.tileBool,
                { backgroundColor: palette[idx], opacity: disabled && !picked ? 0.55 : 1 },
                picked && quizStyles.tilePicked,
              ]}>
              <Text style={quizStyles.tileLabel}>{label}</Text>
              {picked ? <Icon name="check" size={20} color="#fff" /> : null}
            </Pressable>
          );
        })}
      </View>

      {waitingForPartner ? (
        <View style={[quizStyles.waitBanner, { backgroundColor: colors.accentSoft }]}>
          <ActivityIndicator color={colors.accent} />
          <Text style={[quizStyles.waitingText, { color: colors.accent }]}>Waiting for {partnerName}…</Text>
        </View>
      ) : null}

      {partnerAnswer !== undefined && myAnswer === undefined ? (
        <Text style={[quizStyles.waitingSub, { color: colors.textSecondary, textAlign: 'center' }]}>
          {partnerName} already answered — your turn!
        </Text>
      ) : null}
    </View>
  );
}

function RevealPhase({
  question,
  myAnswer,
  partnerAnswer,
  myName,
  partnerName,
  scores,
  memberIds,
  userId,
  index,
  total,
  onNext,
  advancing,
  isLast,
}: {
  question: QuizLiveQuestion;
  myAnswer?: number;
  partnerAnswer?: number;
  myName: string;
  partnerName: string;
  scores: Record<string, number>;
  memberIds: string[];
  userId?: string;
  index: number;
  total: number;
  onNext: () => void;
  advancing: boolean;
  isLast: boolean;
}) {
  const { colors } = useTheme();
  const hasCorrect = question.correctIndex !== undefined;
  const correctLabel =
    hasCorrect && question.correctIndex !== undefined
      ? question.options[question.correctIndex]
      : null;

  let headline = 'Results';
  let sub = '';
  if (hasCorrect) {
    const myRight = myAnswer === question.correctIndex;
    const partnerRight = partnerAnswer === question.correctIndex;
    if (myRight && partnerRight) sub = 'You both got it!';
    else if (myRight) sub = `${myName} got it right`;
    else if (partnerRight) sub = `${partnerName} got it right`;
    else sub = 'Neither got it this time';
  } else if (myAnswer !== undefined && partnerAnswer !== undefined) {
    headline = myAnswer === partnerAnswer ? 'Matched!' : 'Different picks';
    sub = myAnswer === partnerAnswer ? 'Same answer — +1 each' : 'Talk about your choices';
  }

  return (
    <View style={s.stack}>
      <LinearGradient colors={colors.gradient} style={quizStyles.revealHero}>
        <Text style={quizStyles.revealEyebrow}>
          Question {index + 1} of {total}
        </Text>
        <Text style={quizStyles.revealTitle}>{headline}</Text>
        <Text style={quizStyles.revealSub}>{sub}</Text>
        {correctLabel ? <Text style={quizStyles.revealAnswer}>Answer: {correctLabel}</Text> : null}
      </LinearGradient>

      <View style={[quizStyles.revealCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Text style={[quizStyles.questionText, { color: colors.text }]}>{question.question}</Text>
        <View style={quizStyles.pickRow}>
          <RevealPick name={myName} label={myAnswer !== undefined ? question.options[myAnswer] : '—'} />
          <RevealPick name={partnerName} label={partnerAnswer !== undefined ? question.options[partnerAnswer] : '—'} />
        </View>
      </View>

      <View style={quizStyles.scoreboardInline}>
        {memberIds.map((id) => (
          <View key={id} style={[quizStyles.scorePill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[quizStyles.scorePillName, { color: colors.textSecondary }]}>
              {id === userId ? myName : partnerName}
            </Text>
            <Text style={[quizStyles.scorePillVal, { color: colors.text }]}>{scores[id] ?? 0}</Text>
          </View>
        ))}
      </View>

      <PrimaryButton
        label={isLast ? 'See final scores' : 'Next question'}
        onPress={onNext}
        loading={advancing}
      />
    </View>
  );
}

function RevealPick({ name, label }: { name: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={quizStyles.pickCol}>
      <Text style={[quizStyles.pickName, { color: colors.textSecondary }]}>{name}</Text>
      <Text style={[quizStyles.pickVal, { color: colors.text }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

const quizStyles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
  hero: { borderRadius: 22, padding: 24, alignItems: 'center', gap: 8 },
  heroEmoji: { fontSize: 44 },
  heroTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  heroEnd: { borderRadius: 22, padding: 28, alignItems: 'center', gap: 10 },
  heroEndEmoji: { fontSize: 52 },
  heroEndTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  heroEndSub: { color: 'rgba(255,255,255,0.88)', fontSize: 14, textAlign: 'center' },
  topicInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 14,
    fontSize: 16,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  roundMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roundTopic: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, flex: 1 },
  roundCount: { fontSize: 13, fontWeight: '800' },
  hostHint: { fontSize: 12, fontWeight: '600' },
  questionCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    minHeight: 100,
    justifyContent: 'center',
  },
  questionText: { fontSize: 20, fontWeight: '800', lineHeight: 28, textAlign: 'center' },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tileGridBool: { flexDirection: 'column' },
  tile: {
    width: '48%',
    minHeight: 88,
    borderRadius: 14,
    padding: 14,
    justifyContent: 'space-between',
    flexGrow: 1,
  },
  tileBool: { width: '100%', minHeight: 72, flexDirection: 'row', alignItems: 'center' },
  tilePicked: { borderWidth: 3, borderColor: '#fff' },
  tileLabel: { color: '#fff', fontSize: 16, fontWeight: '800', flex: 1 },
  waitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
  },
  waitingText: { fontSize: 15, fontWeight: '700' },
  waitingSub: { fontSize: 13, lineHeight: 18 },
  revealHero: { borderRadius: 22, padding: 22, alignItems: 'center', gap: 6 },
  revealEyebrow: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  revealTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
  revealSub: { color: 'rgba(255,255,255,0.9)', fontSize: 15, textAlign: 'center' },
  revealAnswer: { color: '#fff', fontSize: 14, fontWeight: '700', marginTop: 6 },
  revealCard: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 18, gap: 14 },
  pickRow: { flexDirection: 'row', gap: 12 },
  pickCol: { flex: 1, gap: 4 },
  pickName: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  pickVal: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  scoreboard: { width: '100%', gap: 8, marginVertical: 8 },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  scoreName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  scoreVal: { color: '#fff', fontSize: 22, fontWeight: '800' },
  scoreboardInline: { flexDirection: 'row', gap: 10 },
  scorePill: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  scorePillName: { fontSize: 11, fontWeight: '700' },
  scorePillVal: { fontSize: 22, fontWeight: '800' },
});
