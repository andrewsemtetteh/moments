import * as Haptics from '@/lib/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAY_TONES, type PlayTone } from '@/components/activities/explore/explore-catalog';
import { firstName, shade } from '@/components/games/room-ui';
import { PlayHeader } from '@/components/play/PlayHeader';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useLockPackAnswer, usePackAnswers, type PackAnswer } from '@/hooks/play-queries';
import { useTheme } from '@/hooks/useTheme';
import { DEPTHS, getArea, getPack, type PackQuestion } from '@/lib/handpicked';
import { sendPartnerNotification } from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';

const NUDGE_EVERY_MS = 30 * 60_000;
const lastNudge = new Map<string, number>();

function answerText(a: PackAnswer | undefined) {
  if (!a) return '';
  return [a.choice, a.note].filter(Boolean).join('. ');
}

type Entry = { mine?: PackAnswer; theirs?: PackAnswer };

/** A Handpicked question pack: answer separately, then each answer unlocks once you've both locked in. */
export default function PackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pack = getPack(id ?? '');
  const area = pack ? getArea(pack.area) : undefined;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const { data: answers } = usePackAnswers();
  const lock = useLockPackAnswer();

  const [index, setIndex] = useState<number | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const packId = pack?.id;
  const byQuestion = new Map<string, Entry>();
  for (const a of answers ?? []) {
    if (a.pack_id !== packId) continue;
    const entry = byQuestion.get(a.question_id) ?? {};
    if (a.user_id === user?.id) entry.mine = a;
    else entry.theirs = a;
    byQuestion.set(a.question_id, entry);
  }

  // Open on the first question you haven't answered yet (decided once, when answers first load).
  if (index === null && pack && answers) {
    const first = pack.questions.findIndex((qq) => !byQuestion.get(qq.id)?.mine);
    setIndex(first === -1 ? pack.questions.length : first);
  }

  const goTo = (next: number) => {
    setIndex(next);
    setPick(null);
    setNote('');
  };

  if (!pack || !area) return <Redirect href="/(tabs)/activities" />;

  const tone = PLAY_TONES[area.tone];
  const total = pack.questions.length;
  const i = index ?? 0;
  const finished = i >= total;
  const question = pack.questions[Math.min(i, total - 1)];
  const entry = byQuestion.get(question.id) ?? {};
  const partnerName = firstName(partner?.name);
  const depthLabel = DEPTHS.find((d) => d.id === pack.depth)?.label ?? '';
  const canLock = (!!pick || !!note.trim()) && !lock.isPending;
  const firstOpen = pack.questions.findIndex((qq) => !byQuestion.get(qq.id)?.mine);
  const furthest = firstOpen === -1 ? total : firstOpen;

  const lockIn = () => {
    if (!canLock) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    lock.mutate(
      {
        packId: pack.id,
        questionId: question.id,
        choice: pick,
        note: note.trim() || null,
      },
      {
        onSuccess: () => {
          if (entry.theirs || !partner || !relationshipId || !user) return;
          const now = Date.now();
          if (now - (lastNudge.get(pack.id) ?? 0) < NUDGE_EVERY_MS) return;
          lastNudge.set(pack.id, now);
          void sendPartnerNotification(
            relationshipId,
            partner.id,
            'activity',
            `${firstName(user.name)} answered “${pack.title}”. Answer to see theirs.`,
            { relatedId: pack.id },
          ).catch(() => undefined);
        },
        onError: () => Alert.alert('Couldn’t save your answer', 'Check your connection and try again.'),
      },
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: tone.accent }}>
          <PlayHeader title={pack.title} onColor="#FFFFFF" />
        </View>
        <View style={[styles.header, { backgroundColor: tone.accent }]}>
          <View style={styles.intro}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>
                {area.title.toUpperCase()} · {depthLabel.toUpperCase()}
              </Text>
            </View>
            <Text style={styles.introText}>{total} questions. Answer on your own, then see each other’s answers.</Text>
          </View>
          <View style={styles.steps}>
            {pack.questions.map((qq, idx) => {
              const mine = !!byQuestion.get(qq.id)?.mine;
              const current = idx === i && !finished;
              return (
                <Pressable
                  key={qq.id}
                  onPress={() => goTo(idx)}
                  disabled={idx > furthest}
                  accessibilityRole="button"
                  accessibilityLabel={`Question ${idx + 1}${mine ? ', answered' : ''}`}
                  hitSlop={8}
                  style={[
                    styles.step,
                    {
                      backgroundColor: current ? '#FFFFFF' : mine ? 'rgba(255,255,255,0.7)' : 'rgba(255,255,255,0.28)',
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        <View style={styles.body}>
          {finished ? (
            <Summary
              questions={pack.questions}
              byQuestion={byQuestion}
              partnerName={partnerName}
              tone={tone}
              onOpen={goTo}
            />
          ) : (
            <>
              <LinearGradient
                colors={[shade(tone.accent, -0.05), shade(tone.accent, -0.35)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.questionCard}>
                <View style={styles.glow} pointerEvents="none" />
                <View style={styles.pill}>
                  <Text style={styles.pillText}>
                    QUESTION {i + 1} OF {total}
                  </Text>
                </View>
                <Text style={styles.question}>{question.text}</Text>
              </LinearGradient>

              {entry.mine ? (
                <View style={styles.reveal}>
                  <AnswerCard
                    label="You"
                    avatarName={user?.name}
                    avatarUrl={user?.avatar_url}
                    text={answerText(entry.mine)}
                    tint={tone.soft}
                  />
                  {entry.theirs ? (
                    <AnswerCard
                      label={partnerName}
                      avatarName={partner?.name}
                      avatarUrl={partner?.avatar_url}
                      text={answerText(entry.theirs)}
                    />
                  ) : (
                    <View
                      style={[
                        styles.statusBox,
                        {
                          backgroundColor: colors.surfaceElevated,
                          borderColor: colors.border,
                        },
                      ]}>
                      <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={32} />
                      <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                        Waiting for {partnerName}. You’ll both see each other’s answer once they reply.
                      </Text>
                    </View>
                  )}
                  <ActionBar
                    label={i + 1 >= total ? 'See all answers' : 'Next question'}
                    color={tone.accent}
                    onPress={() => goTo(i + 1)}
                    onBack={i > 0 ? () => goTo(i - 1) : undefined}
                  />
                </View>
              ) : (
                <>
                  {question.picks ? (
                    <View style={styles.picks}>
                      {question.picks.map((p) => {
                        const selected = pick === p;
                        return (
                          <Pressable
                            key={p}
                            onPress={() => {
                              void Haptics.selectionAsync();
                              setPick(selected ? null : p);
                            }}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                            style={[
                              styles.pick,
                              {
                                backgroundColor: selected ? tone.accent : colors.surfaceElevated,
                                borderColor: selected ? shade(tone.accent, -0.25) : colors.border,
                              },
                            ]}>
                            <Text style={[styles.pickText, { color: selected ? '#FFFFFF' : colors.text }]}>{p}</Text>
                            {selected ? <Icon name="check" size={16} color="#FFFFFF" /> : null}
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : null}

                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder={question.picks ? 'Add a few words (optional)' : 'Write your answer'}
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    maxLength={500}
                    accessibilityLabel="Your answer"
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                      },
                    ]}
                  />

                  <View
                    style={[
                      styles.statusBox,
                      {
                        backgroundColor: colors.surfaceElevated,
                        borderColor: colors.border,
                      },
                    ]}>
                    <Avatar name={partner?.name} imageUrl={partner?.avatar_url} size={32} />
                    <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                      {entry.theirs
                        ? `${partnerName} answered. Theirs unlocks when you lock in yours.`
                        : `${partnerName} hasn’t answered yet.`}
                    </Text>
                    {entry.theirs ? <Icon name="lock" size={18} color={colors.textSecondary} /> : null}
                  </View>

                  <ActionBar
                    label={lock.isPending ? 'Locking in…' : entry.theirs ? 'Lock in and reveal' : 'Lock in'}
                    color={tone.accent}
                    disabled={!canLock}
                    onPress={lockIn}
                    onBack={i > 0 ? () => goTo(i - 1) : undefined}
                  />
                </>
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function ActionBar({
  label,
  color,
  onPress,
  onBack,
  disabled,
}: {
  label: string;
  color: string;
  onPress: () => void;
  onBack?: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.actionBar}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Previous question"
          style={({ pressed }) => [
            styles.backSquare,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
          ]}>
          <Icon name="chevronLeft" size={24} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={styles.actionGrow}>
        <ChunkyAction label={label} color={color} onPress={onPress} disabled={disabled} />
      </View>
    </View>
  );
}

function ChunkyAction({
  label,
  color,
  onPress,
  disabled,
}: {
  label: string;
  color: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: color,
          borderBottomColor: shade(color, -0.3),
          borderBottomWidth: pressed ? 1 : 5,
          marginTop: pressed ? 4 : 0,
          opacity: disabled ? 0.45 : 1,
        },
      ]}>
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

function AnswerCard({
  label,
  avatarName,
  avatarUrl,
  text,
  tint,
}: {
  label: string;
  avatarName?: string | null;
  avatarUrl?: string | null;
  text: string;
  tint?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.answer,
        {
          backgroundColor: tint ?? colors.surfaceElevated,
          borderColor: colors.border,
        },
      ]}>
      <View style={styles.answerHead}>
        <Avatar name={avatarName} imageUrl={avatarUrl} size={28} />
        <Text style={[styles.answerName, { color: colors.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.answerText, { color: colors.text }]}>{text}</Text>
    </View>
  );
}

function Summary({
  questions,
  byQuestion,
  partnerName,
  tone,
  onOpen,
}: {
  questions: PackQuestion[];
  byQuestion: Map<string, Entry>;
  partnerName: string;
  tone: PlayTone;
  onOpen: (index: number) => void;
}) {
  const { colors } = useTheme();
  const both = questions.filter((qq) => byQuestion.get(qq.id)?.mine && byQuestion.get(qq.id)?.theirs).length;
  return (
    <View style={styles.summary}>
      <LinearGradient
        colors={[shade(tone.accent, -0.05), shade(tone.accent, -0.35)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.questionCard}>
        <View style={styles.glow} pointerEvents="none" />
        <View style={styles.pill}>
          <Text style={styles.pillText}>
            {both} OF {questions.length} UNLOCKED
          </Text>
        </View>
        <Text style={styles.question}>
          {both === questions.length ? 'You’ve both answered everything' : `Waiting on ${partnerName} for the rest`}
        </Text>
      </LinearGradient>

      {questions.map((qq, idx) => {
        const e = byQuestion.get(qq.id) ?? {};
        const open = !!e.mine && !!e.theirs;
        return (
          <Pressable
            key={qq.id}
            onPress={() => onOpen(idx)}
            accessibilityRole="button"
            style={[
              styles.summaryRow,
              {
                backgroundColor: colors.surfaceElevated,
                borderColor: colors.border,
              },
            ]}>
            <Text style={[styles.summaryQ, { color: colors.text }]}>{qq.text}</Text>
            <Text style={[styles.summaryA, { color: colors.textSecondary }]}>
              You: {e.mine ? answerText(e.mine) : 'not answered'}
            </Text>
            <Text style={[styles.summaryA, { color: colors.textSecondary }]}>
              {partnerName}: {open ? answerText(e.theirs) : e.theirs ? 'answered, answer to unlock' : 'not answered'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingBottom: 22,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  intro: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 22, gap: 14 },
  introText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 27,
    letterSpacing: -0.3,
  },
  steps: { flexDirection: 'row', gap: 6, paddingHorizontal: 24 },
  step: { flex: 1, height: 6, borderRadius: 3 },
  body: { padding: 16, paddingTop: 18, gap: 14 },
  questionCard: {
    borderRadius: 28,
    padding: 22,
    gap: 14,
    minHeight: 170,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(255,255,255,0.13)',
    right: -70,
    top: -80,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  question: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '900',
    lineHeight: 29,
    letterSpacing: -0.4,
  },
  picks: { gap: 8 },
  pick: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pickText: { flex: 1, fontSize: 16, fontWeight: '700' },
  input: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    fontSize: 16,
    lineHeight: 22,
    minHeight: 84,
    textAlignVertical: 'top',
  },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  statusText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  action: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  reveal: { gap: 12 },
  actionBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actionGrow: { flex: 1 },
  backSquare: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  answer: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 10,
  },
  answerHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  answerName: { fontSize: 13, fontWeight: '800' },
  answerText: { fontSize: 17, fontWeight: '600', lineHeight: 24 },
  summary: { gap: 12 },
  summaryRow: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 6,
  },
  summaryQ: { fontSize: 16, fontWeight: '800', lineHeight: 22 },
  summaryA: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
});
