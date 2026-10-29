import * as Haptics from '@/lib/haptics';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { KeyboardFormScrollView } from '@/components/layout/KeyboardFormScrollView';
import { TextInput } from '@/components/ui/ThemedTextInput';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAY_TONES, type PlayTone } from '@/components/activities/explore/explore-catalog';
import { ChunkyButton, firstName, shade } from '@/components/games/room-ui';
import { GuessQuiz, type GuessRow } from '@/components/play/GuessQuiz';
import { CommentBox } from '@/components/play/CommentBox';
import { PickList } from '@/components/play/PickList';
import { PlayHeader } from '@/components/play/PlayHeader';
import { PLAY_GUTTER, PlayHero, PlayPill, playCardStyle, playEdge } from '@/components/play/PlayKit';
import { Icon } from '@/components/ui/Icon';
import { NudgeButton } from '@/components/ui/NudgeButton';
import { Avatar } from '@/components/ui/primitives';
import { useLockPackAnswer, usePackAnswers, type PackAnswer } from '@/hooks/play-queries';
import { useLightStatusBar } from '@/hooks/useLightStatusBar';
import { useTheme } from '@/hooks/useTheme';
import { encodeAttachment, type ChatAttachment } from '@/lib/chat-attachments';
import {
  DEPTHS,
  getArea,
  getPack,
  answerHome,
  savedAs,
  storedPackId,
  type HandpickedFormat,
  type PackQuestion,
} from '@/lib/handpicked';
import { usePlayProgressStore } from '@/stores/play-progress-store';
import { sendMessage, sendPartnerNotification } from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';

const NUDGE_EVERY_MS = 30 * 60_000;
const lastNudge = new Map<string, number>();

/** "I'm done, your turn" from the end of a pack. False while it's cooling down (10 minutes). */
async function nudgeForPack(
  relationshipId: string,
  partnerId: string,
  myName: string,
  packId: string,
  packTitle: string,
): Promise<boolean> {
  const key = `nudge:${packId}`;
  const now = Date.now();
  if (now - (lastNudge.get(key) ?? 0) < 10 * 60_000) return false;
  lastNudge.set(key, now);
  await sendPartnerNotification(
    relationshipId,
    partnerId,
    'activity',
    `${myName} finished “${packTitle}” and is waiting on your answers.`,
    { relatedId: packId },
  ).catch(() => undefined);
  return true;
}
const QUICK_REACTIONS = ['❤️', '😂', '🥹', '🔥', '🤯'];
// Packs whose results card this phone already posted to chat (so a re-render can't double post).
const resultsPosted = new Set<string>();
// Packs whose "your turn" card this phone already posted (once per pack, when you finish your side).
const turnPosted = new Set<string>();

function answerText(a: PackAnswer | undefined) {
  if (!a) return '';
  return [a.choice, a.note].filter(Boolean).join('. ');
}

type Entry = { mine?: PackAnswer; theirs?: PackAnswer };

/** Words that change with how the set plays (questions, quiz, cards or things to do). */
const COPY: Record<
  HandpickedFormat,
  { item: string; intro: (n: number) => string; lock: string; write: string; pickNote: string }
> = {
  questions: {
    item: 'QUESTION',
    intro: (n) => `${n} questions. Answer on your own, then see each other’s answers.`,
    lock: 'Lock in',
    write: 'Write your answer',
    pickNote: 'Add a few words (optional)',
  },
  quizzes: {
    item: 'QUESTION',
    intro: (n) => `${n} quick picks. Answer for yourself and see how many you match.`,
    lock: 'Lock in',
    write: 'Write your answer',
    pickNote: 'Add a few words (optional)',
  },
  prompts: {
    item: 'CARD',
    intro: (n) => `${n} cards. Write your answer, or talk it through and jot down a line.`,
    lock: 'Lock in',
    write: 'Write your answer',
    pickNote: 'Add a few words (optional)',
  },
  activities: {
    item: 'TO DO',
    intro: (n) => `${n} things to do together. Tick each one off and say how it went.`,
    lock: 'Mark as done',
    write: 'How did it go?',
    pickNote: 'How did it go? (optional)',
  },
};

/** What a set is, on its chat card ("ROMANCE · QUIZ"). */
const KIND_LABEL: Record<HandpickedFormat, string> = {
  questions: 'Questions',
  quizzes: 'Quiz',
  prompts: 'Cards',
  activities: 'To do',
};

/** The emoji on a pack's chat card (packs have none of their own). */
const FORMAT_EMOJI: Record<HandpickedFormat, string> = {
  questions: '💬',
  quizzes: '🧠',
  prompts: '🃏',
  activities: '✅',
};

/** Two answers match when both tapped the same pick (quizzes). */
function isMatch(e: Entry) {
  return !!e.mine?.choice && e.mine.choice === e.theirs?.choice;
}

const GUESS_INTRO = (n: number) =>
  `${n} questions. Answer them all for yourself, then guess your partner’s. Results when you’ve both finished.`;

/** A Handpicked question pack: answer separately, then each answer unlocks once you've both locked in. */
export default function PackScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const pack = getPack(id ?? '');
  const area = pack ? getArea(pack.area) : undefined;
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  // Coloured header with white text: light clock and battery while this page shows.
  useLightStatusBar();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const { data: answers } = usePackAnswers();
  const lock = useLockPackAnswer();
  const queryClient = useQueryClient();
  // What you've already sent back on each answer this visit, so the row shows it as sent.
  const [sentBack, setSentBack] = useState<Record<string, string>>({});

  const postToChat = async (attachment: ChatAttachment) => {
    if (!relationshipId || !user) return;
    await sendMessage(relationshipId, user.id, encodeAttachment(attachment));
    void queryClient.invalidateQueries({ queryKey: ['messages', relationshipId] });
  };

  /** "Andrew finished “Deep talks”. Your turn…": the pack as a turn card in your chat. */
  const postTurnCard = (next = 'Your turn: answer to see each other’s.') => {
    if (!pack || !user) return;
    postToChat({
      type: 'game',
      kind: 'pack',
      id: pack.id,
      title: pack.title,
      emoji: FORMAT_EMOJI[pack.format ?? 'questions'],
      status: 'turn',
      line: `${firstName(user.name)} finished “${pack.title}”. ${next}`,
    }).catch(() => turnPosted.delete(pack.id));
  };

  const [index, setIndex] = useState<number | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const packId = pack?.id;
  const byQuestion = new Map<string, Entry>();
  for (const a of answers ?? []) {
    const home = answerHome(a);
    if (home.packId !== packId) continue;
    const entry = byQuestion.get(home.questionId) ?? {};
    if (a.user_id === user?.id) entry.mine = a;
    else entry.theirs = a;
    byQuestion.set(home.questionId, entry);
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
  const format = pack.format ?? 'questions';
  const copy = COPY[format];
  const total = pack.questions.length;
  const i = index ?? 0;
  const finished = i >= total;
  const question = pack.questions[Math.min(i, total - 1)];
  const entry = byQuestion.get(question.id) ?? {};
  const partnerName = firstName(partner?.name);
  const depthLabel = DEPTHS.find((d) => d.id === pack.depth)?.label ?? '';
  const guessing = format === 'quizzes' && !!pack.guessPartner;
  const canLock = (!!pick || !!note.trim()) && !lock.isPending;
  const firstOpen = pack.questions.findIndex((qq) => !byQuestion.get(qq.id)?.mine);
  const furthest = firstOpen === -1 ? total : firstOpen;

  const lockIn = () => {
    if (!canLock) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    lock.mutate(
      { ...savedAs(pack, question), choice: pick, note: note.trim() || null },
      {
        onSuccess: () => {
          // Straight on to the next question: answers only show at the end, in the summary.
          goTo(i + 1);
          const finishedMine = pack.questions.every((qq) => qq.id === question.id || !!byQuestion.get(qq.id)?.mine);
          const matched = format === 'quizzes' && !!pick && pick === entry.theirs?.choice;
          if (relationshipId) {
            void usePlayProgressStore
              .getState()
              .award(
                relationshipId,
                {
                  xp: 8 + (finishedMine ? 40 : 0) + (matched ? 5 : 0),
                  stats: {
                    pack_answers: 1,
                    ...(finishedMine ? { packs_completed: 1 } : {}),
                    ...(format === 'activities' ? { together_done: 1 } : {}),
                    ...(matched ? { sync_matches: 1 } : {}),
                  },
                  events: { pack_answered: 1, ...(matched ? { sync_match: 1 } : {}) },
                },
                'Pack answer',
              );
          }
          // This answer finished the pack for both of you: drop the results card in chat.
          const allDone = pack.questions.every((qq) => {
            const e = byQuestion.get(qq.id);
            return (qq.id === question.id || !!e?.mine) && !!e?.theirs;
          });
          if (allDone && !resultsPosted.has(pack.id)) {
            resultsPosted.add(pack.id);
            postToChat({
              type: 'play_result',
              packId: pack.id,
              title: pack.title,
              area: area.title,
              count: total,
            }).catch(() => resultsPosted.delete(pack.id));
            // And tell them: the pack is done for you both (in the app and on their phone).
            if (partner && relationshipId && user) {
              void sendPartnerNotification(
                relationshipId,
                partner.id,
                'activity',
                `You and ${firstName(user.name)} finished “${pack.title}”. See all your answers.`,
                { relatedId: pack.id },
              ).catch(() => undefined);
            }
            return;
          }
          if (!partner || !relationshipId || !user) return;
          // You've finished your side and they haven't: a "your turn" card in chat (once).
          if (finishedMine && !turnPosted.has(pack.id)) {
            turnPosted.add(pack.id);
            postTurnCard();
          }
          const now = Date.now();
          if (now - (lastNudge.get(pack.id) ?? 0) < NUDGE_EVERY_MS) return;
          lastNudge.set(pack.id, now);
          void sendPartnerNotification(
            relationshipId,
            partner.id,
            'activity',
            // They'd answered this one first: now both answers can be seen.
            entry.theirs
              ? `${firstName(user.name)} answered too in “${pack.title}”. See both answers.`
              : `${firstName(user.name)} answered “${pack.title}”. Answer to see theirs.`,
            { relatedId: pack.id },
          ).catch(() => undefined);
        },
        onError: () => Alert.alert('Couldn’t save your answer', 'Check your connection and try again.'),
      },
    );
  };

  /** Guess quiz finished on this phone: every answer and guess saved together. */
  const submitGuesses = async (rows: GuessRow[]) => {
    try {
      await Promise.all(
        rows.map((r) =>
          lock.mutateAsync({ packId: storedPackId(pack), questionId: r.questionId, choice: r.choice, note: null, guess: r.guess }),
        ),
      );
    } catch {
      Alert.alert('Couldn’t save your answers', 'Check your connection and try again.');
      return false;
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const partnerDone = pack.questions.every((qq) => !!byQuestion.get(qq.id)?.theirs);
    const right = partnerDone ? rows.filter((r) => r.guess === byQuestion.get(r.questionId)?.theirs?.choice).length : 0;
    if (partnerDone && !resultsPosted.has(pack.id)) {
      // Finished by you both: the results in chat, scored from each side (how well they read you).
      const theyRead = rows.filter((r) => byQuestion.get(r.questionId)?.theirs?.guess === r.choice).length;
      resultsPosted.add(pack.id);
      postToChat({
        type: 'guess_result',
        packId: pack.id,
        title: pack.title,
        area: area.title,
        total,
        senderScore: right,
        otherScore: theyRead,
      }).catch(() => resultsPosted.delete(pack.id));
    } else if (!partnerDone && !turnPosted.has(pack.id)) {
      turnPosted.add(pack.id);
      postTurnCard('Your turn: answer for yourself, then guess theirs.');
    }
    if (relationshipId) {
      void usePlayProgressStore.getState().award(
        relationshipId,
        {
          xp: 8 * rows.length + 40 + 5 * right,
          stats: { pack_answers: rows.length, packs_completed: 1, ...(right ? { sync_matches: right } : {}) },
          events: { pack_answered: rows.length, ...(right ? { sync_match: right } : {}) },
        },
        'Guess quiz',
      );
    }
    if (partner && relationshipId && user) {
      void sendPartnerNotification(
        relationshipId,
        partner.id,
        'activity',
        partnerDone
          ? `${firstName(user.name)} finished “${pack.title}”. Results are in: see who knew who best.`
          : `${firstName(user.name)} finished “${pack.title}”. Your turn: answer for yourself, then guess theirs.`,
        { relatedId: pack.id },
      ).catch(() => undefined);
    }
    return true;
  };

  // The results post themselves when the quiz finishes, so a note from the end goes as a note
  // (not a second copy of the scores).
  const sendGuessComment = (comment: string) =>
    postToChat({
      type: 'play_comment',
      packId: pack.id,
      title: pack.part?.setTitle ?? pack.title,
      area: area.title,
      kind: KIND_LABEL[format],
      comment,
    });

  // From the end of the pack: "I'm done, your turn".
  const nudgePartner = () =>
    partner && relationshipId && user
      ? nudgeForPack(relationshipId, partner.id, firstName(user.name), pack.id, pack.title)
      : Promise.resolve(false);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <KeyboardFormScrollView
        // The field you tap comes above the keyboard, and the page scrolls on to its last button.
        // The home-indicator padding at the end isn't needed above the keyboard.
        endGap={-insets.bottom}
        topInset={insets.top + 72}
        // No pull past the top (it showed an empty gap above the page).
        bounces={false}
        overScrollMode="never"
        contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
        stickyHeaderIndices={[0]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={{ backgroundColor: tone.accent }}>
          <PlayHeader title={pack.title} onColor="#FFFFFF" />
        </View>
        <PlayHero color={tone.accent} pill={`${area.title} · ${depthLabel}`} blurb={pack.blurb ?? (guessing ? GUESS_INTRO(total) : copy.intro(total))}
          note={pack.blurb ? (guessing ? GUESS_INTRO(total) : copy.intro(total)) : undefined}>
          {guessing ? null : (
          <View style={styles.steps}>
            {pack.questions.map((qq, idx) => {
              const mine = !!byQuestion.get(qq.id)?.mine;
              const current = idx === i && !finished;
              return (
                <Pressable
                  key={qq.id}
                  onPress={() => goTo(idx)}
                  // Only once you've answered everything (mid-game it would show your answers again).
                  disabled={firstOpen !== -1 || idx > furthest}
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
          )}
        </PlayHero>

        <View style={styles.body}>
          {guessing && user ? (
            <GuessQuiz
              pack={pack}
              tone={tone}
              entries={byQuestion}
              userId={user.id}
              me={{ name: firstName(user.name), avatar: user.avatar_url }}
              partner={{ name: partnerName, avatar: partner?.avatar_url }}
              onSubmit={submitGuesses}
              onComment={sendGuessComment}
              onNudge={nudgePartner}
            />
          ) : finished ? (
            <Summary
              questions={pack.questions}
              byQuestion={byQuestion}
              partnerName={partnerName}
              tone={tone}
              format={format}
              onOpen={goTo}
              partnerAvatar={partner?.avatar_url}
              onNudge={nudgePartner}
              onComment={(text) =>
                postToChat({
                  type: 'play_comment',
                  packId: pack.id,
                  title: pack.part?.setTitle ?? pack.title,
                  area: area.title,
                  kind: KIND_LABEL[format],
                  comment: text,
                })
              }
            />
          ) : (
            <>
              <LinearGradient
                colors={[shade(tone.accent, -0.05), shade(tone.accent, -0.35)]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.questionCard}>
                <View style={styles.glow} pointerEvents="none" />
                <PlayPill label={`${copy.item} ${i + 1} of ${total}`} />
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
                    <>
                      <AnswerCard
                        label={partnerName}
                        avatarName={partner?.name}
                        avatarUrl={partner?.avatar_url}
                        text={answerText(entry.theirs)}
                      />
                      {format === 'quizzes' ? (
                        <View
                          style={[
                            styles.matchPill,
                            {
                              backgroundColor: isMatch(entry) ? tone.accent : colors.surfaceElevated,
                              borderColor: colors.border,
                            },
                          ]}>
                          <Text
                            style={[styles.matchText, { color: isMatch(entry) ? '#FFFFFF' : colors.textSecondary }]}>
                            {isMatch(entry) ? 'It’s a match! 🎉' : 'Different picks. Ask why!'}
                          </Text>
                        </View>
                      ) : null}
                      <RespondRow
                        key={question.id}
                        partnerName={partnerName}
                        accent={tone.accent}
                        sent={sentBack[question.id]}
                        onSend={async (back) => {
                          await postToChat({
                            type: 'play_answer',
                            packId: pack.id,
                            packTitle: pack.title,
                            question: question.text,
                            answer: answerText(entry.theirs),
                            answerBy: partnerName,
                            ...back,
                          });
                          setSentBack((prev) => ({ ...prev, [question.id]: back.reaction ?? 'reply' }));
                        }}
                      />
                    </>
                  ) : null}
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
                    <PickList picks={question.picks} value={pick} onChange={setPick} accent={tone.accent} />
                  ) : null}

                  <TextInput
                    value={note}
                    onChangeText={setNote}
                    placeholder={question.picks ? copy.pickNote : copy.write}
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
                        borderWidth: playEdge(colors),
                      },
                    ]}
                  />

                  {/* They've answered this one already (both show at the end). Nothing when they haven't. */}
                  {entry.theirs ? (
                    <View style={[styles.waitingLine, { backgroundColor: tone.soft }]}>
                      <Icon name="lock" size={14} color={tone.accent} filled />
                      <Text style={[styles.waitingText, { color: tone.accent }]} numberOfLines={2}>
                        {partnerName} has answered this one. You’ll see both at the end.
                      </Text>
                    </View>
                  ) : null}

                  <ActionBar
                    label={lock.isPending ? 'Saving…' : copy.lock}
                    color={tone.accent}
                    disabled={!canLock}
                    onPress={lockIn}
                  />
                </>
              )}
            </>
          )}
        </View>
      </KeyboardFormScrollView>
    </View>
  );
}

/**
 * React to or answer back on their answer, like Paired: a tap on an emoji or a quick
 * reply goes to your chat as a card quoting the question and their answer.
 */
function RespondRow({
  partnerName,
  accent,
  sent,
  onSend,
}: {
  partnerName: string;
  accent: string;
  sent?: string;
  onSend: (back: { reaction?: string; reply?: string }) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  const send = async (back: { reaction?: string; reply?: string }) => {
    if (busy) return;
    setBusy(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      await onSend(back);
      setReply('');
    } catch {
      Alert.alert('Couldn’t send', 'Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={[styles.respond, playCardStyle(colors)]}>
      <View style={styles.respondHead}>
        <Text style={[styles.respondTitle, { color: colors.text }]}>
          {sent ? 'Sent to your chat' : `What do you think of ${partnerName}’s answer?`}
        </Text>
        {sent ? <Icon name="check" size={16} color={accent} /> : null}
      </View>
      <View style={styles.reactions}>
        {QUICK_REACTIONS.map((emoji) => {
          const picked = sent === emoji;
          return (
            <Pressable
              key={emoji}
              onPress={() => void send({ reaction: emoji })}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={`React ${emoji}`}
              style={({ pressed }) => [
                styles.reaction,
                {
                  backgroundColor: picked ? shade(accent, 0.75) : colors.background,
                  borderColor: picked ? accent : colors.border,
                  transform: [{ scale: pressed ? 0.9 : 1 }],
                },
              ]}>
              <Text style={styles.reactionEmoji}>{emoji}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={[styles.replyBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
        <TextInput
          value={reply}
          onChangeText={setReply}
          placeholder={`Reply to ${partnerName}…`}
          placeholderTextColor={colors.textTertiary}
          multiline
          maxLength={500}
          accessibilityLabel={`Reply to ${partnerName}`}
          style={[styles.replyInput, { color: colors.text }]}
        />
        <Pressable
          onPress={() => void send({ reply: reply.trim() })}
          disabled={!reply.trim() || busy}
          accessibilityRole="button"
          accessibilityLabel="Send reply"
          hitSlop={6}
          style={[styles.replySend, { backgroundColor: accent, opacity: reply.trim() && !busy ? 1 : 0.4 }]}>
          <Icon name="send" size={16} color="#FFFFFF" filled />
        </Pressable>
      </View>
    </View>
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
          style={({ pressed }) => [styles.backSquare, playCardStyle(colors), { opacity: pressed ? 0.85 : 1 }]}>
          <Icon name="chevronLeft" size={24} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={styles.actionGrow}>
        <ChunkyButton label={label} color={color} onPress={onPress} disabled={disabled} />
      </View>
    </View>
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
    <View style={[styles.answer, playCardStyle(colors), tint ? { backgroundColor: tint } : null]}>
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
  format,
  onOpen,
  partnerAvatar,
  onNudge,
  onComment,
}: {
  questions: PackQuestion[];
  byQuestion: Map<string, Entry>;
  partnerName: string;
  tone: PlayTone;
  format: HandpickedFormat;
  onOpen: (index: number) => void;
  partnerAvatar?: string | null;
  /** Pings your partner; resolves false while it's cooling down. */
  onNudge: () => Promise<boolean>;
  /** A note about the set, sent to your chat. */
  onComment: (text: string) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [nudged, setNudged] = useState(false);
  const theirsCount = questions.filter((qq) => !!byQuestion.get(qq.id)?.theirs).length;
  const both = questions.filter((qq) => byQuestion.get(qq.id)?.mine && byQuestion.get(qq.id)?.theirs).length;
  const matches = questions.filter((qq) => isMatch(byQuestion.get(qq.id) ?? {})).length;
  const allDone = both === questions.length;
  const verdict =
    matches === questions.length
      ? 'Perfectly in sync!'
      : matches >= questions.length / 2
        ? 'Nicely in sync.'
        : 'Plenty to talk about!';
  const headline =
    format === 'quizzes' && allDone
      ? `You matched ${matches} of ${questions.length}. ${verdict}`
      : format === 'activities' && allDone
        ? 'You’ve done them all together'
        : allDone
          ? 'You’ve both answered everything'
          : `Waiting on ${partnerName} for the rest`;
  return (
    <View style={styles.summary}>
      <LinearGradient
        colors={[shade(tone.accent, -0.05), shade(tone.accent, -0.35)]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.questionCard}>
        <View style={styles.glow} pointerEvents="none" />
        <PlayPill label={`${both} of ${questions.length} unlocked`} />
        <Text style={styles.question}>{headline}</Text>
      </LinearGradient>

      {/* Where your partner is in the pack, and a nudge while they're not done. */}
      {theirsCount < questions.length ? (
        <View style={[styles.statusBox, playCardStyle(colors)]}>
          <Avatar name={partnerName} imageUrl={partnerAvatar ?? undefined} size={36} />
          <View style={styles.statusLines}>
            <Text style={[styles.statusTitle, { color: colors.text }]} numberOfLines={1}>
              {theirsCount === 0 ? `${partnerName} hasn’t started` : `${partnerName}: ${theirsCount} of ${questions.length}`}
            </Text>
            <Text style={[styles.statusText, { color: colors.textSecondary }]} numberOfLines={2}>
              You’ll get a notification when they finish.
            </Text>
          </View>
          <NudgeButton
            name={partnerName}
            nudged={nudged}
            accent={tone.accent}
            onPress={() =>
              void onNudge().then((sent) => {
                setNudged(true);
                if (!sent) Alert.alert('Already nudged', `We let ${partnerName} know a moment ago.`);
              })
            }
          />
        </View>
      ) : null}

      {questions.map((qq, idx) => {
        const e = byQuestion.get(qq.id) ?? {};
        const open = !!e.mine && !!e.theirs;
        return (
          <Pressable
            key={qq.id}
            onPress={() => onOpen(idx)}
            accessibilityRole="button"
            style={[styles.summaryRow, playCardStyle(colors)]}>
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

      <CommentBox accent={tone.accent} partner={partnerName} onSend={onComment} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  steps: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, height: 6, borderRadius: 3 },
  body: { padding: PLAY_GUTTER, paddingTop: 18, gap: 14 },
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
  question: { color: '#FFFFFF', fontSize: 23, fontWeight: '900', lineHeight: 29, letterSpacing: -0.4 },
  input: { borderRadius: 16, padding: 14, fontSize: 16, lineHeight: 22, minHeight: 84, textAlignVertical: 'top' },
  statusBox: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  statusLines: { flex: 1, gap: 2 },
  statusTitle: { fontSize: 15, fontWeight: '800' },
  statusText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  waitingLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  waitingText: { flex: 1, fontSize: 14, fontWeight: '800' },
  reveal: { gap: 12 },
  actionBar: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  actionGrow: { flex: 1 },
  backSquare: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  answer: { padding: 16, gap: 10 },
  answerHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  answerName: { fontSize: 13, fontWeight: '800' },
  answerText: { fontSize: 17, fontWeight: '600', lineHeight: 24 },
  respond: { padding: 14, gap: 12 },
  respondHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  respondTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  reactions: { flexDirection: 'row', justifyContent: 'space-between' },
  reaction: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reactionEmoji: { fontSize: 24 },
  replyBox: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
  },
  replyInput: { flex: 1, fontSize: 15, lineHeight: 20, maxHeight: 100, paddingVertical: 7 },
  replySend: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  matchPill: {
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  matchText: { fontSize: 14, fontWeight: '800' },
  summary: { gap: 12 },
  summaryRow: { padding: 16, gap: 6 },
  summaryQ: { fontSize: 16, fontWeight: '800', lineHeight: 22 },
  summaryA: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
});
