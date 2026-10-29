import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from '@/lib/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, ZoomIn } from 'react-native-reanimated';

import type { PlayTone } from '@/components/activities/explore/explore-catalog';
import { ChunkyButton, shade } from '@/components/games/room-ui';
import { CommentBox } from '@/components/play/CommentBox';
import { PickList } from '@/components/play/PickList';
import { PlayPill, playCardStyle, playEdge } from '@/components/play/PlayKit';
import { Crown } from '@/components/ui/Crown';
import { Icon } from '@/components/ui/Icon';
import { NudgeButton } from '@/components/ui/NudgeButton';
import { Avatar } from '@/components/ui/primitives';
import type { PackAnswer } from '@/hooks/play-queries';
import { useTheme } from '@/hooks/useTheme';
import { askPartner } from '@/lib/guess-quiz';
import type { QuestionPack } from '@/lib/handpicked';

type Entry = { mine?: PackAnswer; theirs?: PackAnswer };
type Person = { name: string; avatar?: string | null };
type Draft = { mine: Record<string, string>; guess: Record<string, string> };
type Step = { phase: 'me' | 'switch' | 'them'; index: number };

export type GuessRow = { questionId: string; choice: string; guess: string };

/** You read their pick right / they read yours right (both have answered). */
export function iReadThem(e: Entry) {
  return !!e.mine?.guess && !!e.theirs && e.mine.guess === e.theirs.choice;
}
export function theyReadMe(e: Entry) {
  return !!e.theirs?.guess && !!e.mine && e.theirs.guess === e.mine.choice;
}

const draftKey = (userId: string, packId: string) => `moments_guess_draft:${userId}:${packId}`;

/**
 * A guess quiz, like Paired: first every question for yourself, then every question again as
 * "what would they pick?". Nothing is saved or shown until you've done both; your picks so far
 * stay on this phone, so leaving halfway carries on where you were. Once you've both finished:
 * the podium, everyone's answers side by side (right or wrong), and a note to send to your chat.
 */
export function GuessQuiz({
  pack,
  tone,
  entries,
  userId,
  me,
  partner,
  onSubmit,
  onComment,
  onNudge,
}: {
  pack: QuestionPack;
  tone: PlayTone;
  entries: Map<string, Entry>;
  userId: string;
  me: Person;
  partner: Person;
  /** Saves every answer at once; resolves true once saved. */
  onSubmit: (rows: GuessRow[]) => Promise<boolean>;
  /** Your note on the game, to your chat with both scores. */
  onComment: (comment: string) => Promise<void>;
  onNudge: () => Promise<boolean>;
}) {
  const { colors } = useTheme();
  const questions = pack.questions;
  // The questions still to do (any already saved, from before, are skipped).
  const pending = questions.filter((qq) => !entries.get(qq.id)?.mine);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [step, setStep] = useState<Step | null>(null);
  const [saving, setSaving] = useState(false);

  // Your picks so far on this phone: resume at the first one not done.
  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(draftKey(userId, pack.id))
      .then((raw) => (raw ? (JSON.parse(raw) as Draft) : null))
      .catch(() => null)
      .then((saved) => {
        if (cancelled) return;
        const d = saved ?? { mine: {}, guess: {} };
        setDraft(d);
        const firstMe = pending.findIndex((qq) => !d.mine[qq.id]);
        const firstThem = pending.findIndex((qq) => !d.guess[qq.id]);
        setStep(
          firstMe >= 0
            ? { phase: 'me', index: firstMe }
            : firstThem > 0
              ? { phase: 'them', index: firstThem }
              : firstThem === 0
                ? { phase: 'switch', index: 0 }
                : { phase: 'them', index: Math.max(0, pending.length - 1) },
        );
      });
    return () => {
      cancelled = true;
    };
    // Decided once, when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, pack.id]);

  if (pending.length === 0) {
    return (
      <GuessResults
        pack={pack}
        tone={tone}
        entries={entries}
        me={me}
        partner={partner}
        onComment={onComment}
        onNudge={onNudge}
      />
    );
  }
  if (!draft || !step) return null;

  const saveDraft = (next: Draft) => {
    setDraft(next);
    void AsyncStorage.setItem(draftKey(userId, pack.id), JSON.stringify(next)).catch(() => undefined);
  };

  const last = pending.length - 1;
  const question = pending[Math.min(step.index, last)];
  const value = step.phase === 'me' ? draft.mine[question.id] ?? null : draft.guess[question.id] ?? null;
  const doneMe = pending.filter((qq) => draft.mine[qq.id]).length;
  const doneThem = pending.filter((qq) => draft.guess[qq.id]).length;

  const pick = (p: string | null) => {
    const field = step.phase === 'me' ? 'mine' : 'guess';
    const nextField = { ...draft[field] };
    if (p) nextField[question.id] = p;
    else delete nextField[question.id];
    saveDraft({ ...draft, [field]: nextField });
  };

  const submit = async () => {
    const rows = pending.map((qq) => ({ questionId: qq.id, choice: draft.mine[qq.id], guess: draft.guess[qq.id] }));
    if (rows.some((r) => !r.choice || !r.guess)) return;
    setSaving(true);
    try {
      if (await onSubmit(rows)) await AsyncStorage.removeItem(draftKey(userId, pack.id)).catch(() => undefined);
    } finally {
      setSaving(false);
    }
  };

  const next = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (step.phase === 'switch') return setStep({ phase: 'them', index: 0 });
    if (step.index < last) return setStep({ ...step, index: step.index + 1 });
    if (step.phase === 'me') return setStep({ phase: 'switch', index: 0 });
    void submit();
  };
  const back =
    step.phase === 'switch'
      ? () => setStep({ phase: 'me', index: last })
      : step.index > 0
        ? () => setStep({ ...step, index: step.index - 1 })
        : step.phase === 'them'
          ? () => setStep({ phase: 'switch', index: 0 })
          : undefined;

  return (
    <View style={styles.wrap}>
      <Stages tone={tone} partner={partner.name} phase={step.phase} me={doneMe} them={doneThem} total={pending.length} />

      {step.phase === 'switch' ? (
        <Animated.View entering={FadeIn.duration(250)} style={[styles.switchCard, playCardStyle(colors)]}>
          <SwitchCard tone={tone} me={me} partner={partner} count={pending.length} />
        </Animated.View>
      ) : (
        <Animated.View key={`${step.phase}-${question.id}`} entering={FadeIn.duration(220)} style={styles.wrap}>
          <LinearGradient
            colors={[shade(tone.accent, -0.05), shade(tone.accent, -0.35)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.questionCard}>
            <View style={styles.glow} pointerEvents="none" />
            <PlayPill
              label={`${step.phase === 'me' ? 'About you' : `About ${partner.name}`} · ${step.index + 1} of ${pending.length}`}
            />
            <Text style={styles.question}>
              {step.phase === 'them' ? askPartner(partner.name, question.text) : question.text}
            </Text>
          </LinearGradient>
          <PickList picks={question.picks ?? []} value={value} onChange={pick} accent={tone.accent} />
        </Animated.View>
      )}

      <NavBar
        label={
          step.phase === 'switch'
            ? `Start guessing`
            : step.index < last
              ? 'Next'
              : step.phase === 'me'
                ? `Next: guess ${partner.name}’s`
                : saving
                  ? 'Saving…'
                  : 'Finish'
        }
        color={tone.accent}
        disabled={step.phase !== 'switch' && (!value || saving)}
        onPress={next}
        onBack={back}
      />
    </View>
  );
}

/** Where you are: part 1 (you) and part 2 (them), each with its own little bar. */
function Stages({
  tone,
  partner,
  phase,
  me,
  them,
  total,
}: {
  tone: PlayTone;
  partner: string;
  phase: Step['phase'];
  me: number;
  them: number;
  total: number;
}) {
  const { colors } = useTheme();
  const parts = [
    { label: '1 · About you', done: me, on: phase === 'me' },
    { label: `2 · About ${partner}`, done: them, on: phase !== 'me' },
  ];
  return (
    <View style={styles.stages}>
      {parts.map((p) => (
        <View key={p.label} style={styles.stage}>
          <Text style={[styles.stageLabel, { color: p.on ? colors.text : colors.textTertiary }]} numberOfLines={1}>
            {p.label}
          </Text>
          <View style={[styles.stageTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.stageFill, { backgroundColor: tone.accent, width: `${(p.done / total) * 100}%` }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Between the two parts: now guess theirs. */
function SwitchCard({ tone, me, partner, count }: { tone: PlayTone; me: Person; partner: Person; count: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.switchInner}>
      <View style={styles.pair}>
        <Avatar name={me.name} imageUrl={me.avatar ?? undefined} size={56} />
        <View style={[styles.pairArrow, { backgroundColor: tone.accent }]}>
          <Icon name="chevronRight" size={16} color="#FFFFFF" />
        </View>
        <Avatar name={partner.name} imageUrl={partner.avatar ?? undefined} size={56} />
      </View>
      <Text style={[styles.switchTitle, { color: colors.text }]}>Now, guess {partner.name}’s answers</Text>
      <Text style={[styles.switchText, { color: colors.textSecondary }]}>
        The same {count} questions. This time, pick what you think {partner.name} chose. Nothing is shown until you’ve both
        finished.
      </Text>
    </View>
  );
}

function NavBar({
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
    <View style={styles.nav}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.backSquare, playCardStyle(colors), { opacity: pressed ? 0.85 : 1 }]}>
          <Icon name="chevronLeft" size={24} color={colors.text} />
        </Pressable>
      ) : null}
      <View style={styles.flex}>
        <ChunkyButton label={label} color={color} onPress={onPress} disabled={disabled} />
      </View>
    </View>
  );
}

/** After you've finished: waiting on them, or the podium, both sides' answers and a note to send. */
function GuessResults({
  pack,
  tone,
  entries,
  me,
  partner,
  onComment,
  onNudge,
}: {
  pack: QuestionPack;
  tone: PlayTone;
  entries: Map<string, Entry>;
  me: Person;
  partner: Person;
  onComment: (comment: string) => Promise<void>;
  onNudge: () => Promise<boolean>;
}) {
  const { colors } = useTheme();
  const [nudged, setNudged] = useState(false);
  const questions = pack.questions;
  const theirsDone = questions.filter((qq) => entries.get(qq.id)?.theirs).length;

  if (theirsDone < questions.length) {
    return (
      <Animated.View entering={FadeInUp.duration(300)} style={[styles.waitCard, playCardStyle(colors)]}>
        <View style={[styles.doneBadge, { backgroundColor: tone.accent }]}>
          <Icon name="check" size={28} color="#FFFFFF" />
        </View>
        <Text style={[styles.switchTitle, { color: colors.text }]}>You’re all done</Text>
        <Text style={[styles.switchText, { color: colors.textSecondary }]}>
          Your answers and guesses are locked in. The results unlock when {partner.name} finishes.
        </Text>
        <View style={[styles.waitRow, { borderColor: colors.border }]}>
          <Avatar name={partner.name} imageUrl={partner.avatar ?? undefined} size={36} />
          <View style={styles.waitLines}>
            <Text style={[styles.waitTitle, { color: colors.text }]} numberOfLines={1}>
              {theirsDone === 0 ? `${partner.name} hasn’t started` : `${partner.name}: ${theirsDone} of ${questions.length}`}
            </Text>
            <Text style={[styles.waitText, { color: colors.textSecondary }]} numberOfLines={2}>
              You’ll get a notification when they finish.
            </Text>
          </View>
          <NudgeButton
            name={partner.name}
            nudged={nudged}
            accent={tone.accent}
            onPress={() =>
              void onNudge().then((sent) => {
                setNudged(true);
                if (!sent) Alert.alert('Already nudged', `We let ${partner.name} know a moment ago.`);
              })
            }
          />
        </View>
      </Animated.View>
    );
  }

  const you = questions.filter((qq) => iReadThem(entries.get(qq.id) ?? {})).length;
  const them = questions.filter((qq) => theyReadMe(entries.get(qq.id) ?? {})).length;

  return (
    <View style={styles.wrap}>
      <Podium tone={tone} total={questions.length} me={{ ...me, score: you }} them={{ ...partner, score: them }} />

      {/* Both sides at once: you on the left, them on the right, right or wrong on each guess. */}
      <View style={[styles.columnsHead, playCardStyle(colors)]}>
        <ColumnHead person={me} label="You" score={you} total={questions.length} tone={tone} />
        <View style={[styles.columnsRule, { backgroundColor: colors.border }]} />
        <ColumnHead person={partner} label={partner.name} score={them} total={questions.length} tone={tone} />
      </View>
      {questions.map((qq, i) => {
        const e = entries.get(qq.id) ?? {};
        return (
          <View key={qq.id} style={[styles.qRow, playCardStyle(colors)]}>
            <Text style={[styles.qText, { color: colors.text }]}>
              {i + 1}. {qq.text}
            </Text>
            <View style={styles.cells}>
              <AnswerCell tone={tone} picked={e.mine?.choice} guessed={e.mine?.guess} right={iReadThem(e)} />
              <AnswerCell tone={tone} picked={e.theirs?.choice} guessed={e.theirs?.guess} right={theyReadMe(e)} />
            </View>
          </View>
        );
      })}

      <CommentBox accent={tone.accent} partner={partner.name} onSend={onComment} />
    </View>
  );
}

function ColumnHead({
  person,
  label,
  score,
  total,
  tone,
}: {
  person: Person;
  label: string;
  score: number;
  total: number;
  tone: PlayTone;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.colHead}>
      <Avatar name={person.name} imageUrl={person.avatar ?? undefined} size={36} />
      <View style={styles.flex}>
        <Text style={[styles.colName, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
        <Text style={[styles.colScore, { color: tone.accent }]}>
          {score}/{total} right
        </Text>
      </View>
    </View>
  );
}

/** One person's answer to one question: what they picked, and their guess, right or wrong. */
function AnswerCell({
  tone,
  picked,
  guessed,
  right,
}: {
  tone: PlayTone;
  picked?: string | null;
  guessed?: string | null;
  right: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.cell,
        {
          backgroundColor: right ? tone.soft : colors.surface,
          borderColor: right ? tone.accent : colors.border,
          borderWidth: Math.max(1, playEdge(colors)),
        },
      ]}>
      <Text style={[styles.cellLabel, { color: colors.textTertiary }]}>Picked</Text>
      <Text style={[styles.cellPick, { color: colors.text }]} numberOfLines={2}>
        {picked ?? '—'}
      </Text>
      <View style={styles.cellGuess}>
        <View style={[styles.mark, { backgroundColor: right ? tone.accent : colors.border }]}>
          <Icon name={right ? 'check' : 'close'} size={12} color={right ? '#FFFFFF' : colors.textSecondary} />
        </View>
        <Text style={[styles.cellGuessText, { color: right ? colors.text : colors.textSecondary }]} numberOfLines={2}>
          {right ? 'Guessed right' : `Guessed ${guessed ?? '—'}`}
        </Text>
      </View>
    </View>
  );
}

type PodiumPlayer = Person & { score: number };

/** Who knew the other better: the winner on the tall step with a crown; a tie puts you level. */
function Podium({ tone, total, me, them }: { tone: PlayTone; total: number; me: PodiumPlayer; them: PodiumPlayer }) {
  const { colors } = useTheme();
  const tie = me.score === them.score;
  const [first, second] = me.score >= them.score ? [me, them] : [them, me];
  const spots = tie
    ? [
        { player: me, place: 1, height: 96 },
        { player: them, place: 1, height: 96 },
      ]
    : [
        { player: second, place: 2, height: 64 },
        { player: first, place: 1, height: 110 },
      ];
  return (
    <View style={[styles.podiumCard, playCardStyle(colors)]}>
      <Text style={[styles.podiumTitle, { color: colors.text }]}>
        {tie ? 'Dead heat' : first === me ? `You knew ${them.name} best` : `${them.name} knew you best`}
      </Text>
      <View style={styles.podium}>
        {spots.map(({ player, place, height }, i) => {
          const winner = place === 1 && !tie;
          return (
            <View key={i} style={styles.podiumSpot}>
              <Animated.View entering={ZoomIn.delay(350 + i * 120).springify()} style={styles.podiumPerson}>
                <View style={styles.podiumCrown}>{winner ? <Crown size={30} /> : null}</View>
                <Avatar name={player.name} imageUrl={player.avatar ?? undefined} size={winner ? 60 : 50} />
                <Text style={[styles.podiumName, { color: colors.text }]} numberOfLines={1}>
                  {player === me ? 'You' : player.name}
                </Text>
                <Text style={[styles.podiumScore, { color: colors.textSecondary }]}>
                  {player.score}/{total}
                </Text>
              </Animated.View>
              <Animated.View
                entering={FadeInUp.delay(100 + i * 120).duration(450)}
                style={[styles.podiumStep, { height, backgroundColor: place === 1 ? tone.accent : tone.soft }]}>
                <Text style={[styles.podiumPlace, { color: place === 1 ? '#FFFFFF' : tone.accent }]}>{place}</Text>
              </Animated.View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: 14 },
  stages: { flexDirection: 'row', gap: 12 },
  stage: { flex: 1, gap: 6 },
  stageLabel: { fontSize: 13, fontWeight: '800' },
  stageTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  stageFill: { height: 6, borderRadius: 3 },
  questionCard: { borderRadius: 28, padding: 22, gap: 12, minHeight: 150, justifyContent: 'center', overflow: 'hidden' },
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
  switchCard: { padding: 22 },
  switchInner: { alignItems: 'center', gap: 10 },
  pair: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  pairArrow: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  switchTitle: { fontSize: 21, fontWeight: '900', letterSpacing: -0.3, textAlign: 'center' },
  switchText: { fontSize: 15, fontWeight: '600', lineHeight: 21, textAlign: 'center' },
  nav: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  backSquare: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  waitCard: { padding: 22, alignItems: 'center', gap: 10 },
  doneBadge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  waitRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 14,
    marginTop: 6,
  },
  waitLines: { flex: 1, gap: 2 },
  waitTitle: { fontSize: 15, fontWeight: '800' },
  waitText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  columnsHead: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 },
  columnsRule: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  colHead: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  colName: { fontSize: 15, fontWeight: '900' },
  colScore: { fontSize: 13, fontWeight: '800' },
  qRow: { padding: 12, gap: 10 },
  qText: { fontSize: 15, fontWeight: '800', lineHeight: 21 },
  cells: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, borderRadius: 14, padding: 10, gap: 3 },
  cellLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  cellPick: { fontSize: 15, fontWeight: '800', lineHeight: 20 },
  cellGuess: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  mark: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cellGuessText: { flex: 1, fontSize: 12, fontWeight: '700', lineHeight: 16 },
  podiumCard: { paddingTop: 18, paddingHorizontal: 18, gap: 14, overflow: 'hidden' },
  podiumTitle: { fontSize: 20, fontWeight: '900', letterSpacing: -0.3, textAlign: 'center' },
  podium: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 10 },
  podiumSpot: { flex: 1, maxWidth: 150, alignItems: 'center' },
  podiumPerson: { alignItems: 'center', gap: 3, marginBottom: 10 },
  podiumCrown: { height: 24, justifyContent: 'flex-end', marginBottom: 2 },
  podiumName: { fontSize: 15, fontWeight: '900', maxWidth: 130, marginTop: 4 },
  podiumScore: { fontSize: 13, fontWeight: '800', fontVariant: ['tabular-nums'] },
  podiumStep: { alignSelf: 'stretch', borderTopLeftRadius: 16, borderTopRightRadius: 16, alignItems: 'center', paddingTop: 10 },
  podiumPlace: { fontSize: 28, fontWeight: '900' },
});
