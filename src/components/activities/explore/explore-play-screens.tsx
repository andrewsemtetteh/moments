import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PrimaryButton } from '@/components/ui/primitives';
import {
    APPRECIATION_PROMPTS,
    ATTACHMENT_QUESTIONS,
    COMPATIBILITY_QUESTIONS,
    DATE_NIGHT_CHALLENGE,
    EMOJI_STORIES,
    FINISH_THE_SENTENCE,
    GAMES,
    LOVE_QUIZ,
    PERSONALITY_QUESTIONS,
    THIRTY_SIX_QUESTIONS,
    WEEK_CHALLENGE,
    WHOS_MORE_LIKELY,
    pickFortune,
    pickRandomDateIdea,
    type Game,
} from '@/constants/activity-content';
import { useTheme } from '@/hooks/useTheme';

import { exploreStyles as s } from './explore-styles';

function gameByName(name: string): Game {
  return GAMES.find((g) => g.name === name) ?? GAMES[0];
}

/** Two-option choice rounds (This or That / Would You Rather). */
export function ChoiceRoundsScreen({ gameName }: { gameName: 'This or That' | 'Would You Rather' }) {
  const { colors } = useTheme();
  const game = gameByName(gameName);
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const round = game.rounds[index % game.rounds.length];
  const total = game.rounds.length;

  const next = () => {
    void Haptics.selectionAsync();
    setPicked(null);
    setIndex((i) => i + 1);
  };

  return (
    <View style={s.stack}>
      <Text style={[styles.progress, { color: colors.textSecondary }]}>
        {Math.min(index + 1, total)} / {total}
      </Text>
      <Text style={[styles.prompt, { color: colors.text }]}>{round.prompt}</Text>
      <View style={styles.choiceCol}>
        {(round.options ?? []).map((opt) => {
          const active = picked === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPicked(opt);
              }}
              style={[
                styles.choiceCard,
                {
                  backgroundColor: active ? colors.accentSoft : colors.surfaceElevated,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}>
              <Text style={[styles.choiceText, { color: colors.text }]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Both pick independently — then reveal and talk it through.
      </Text>
      <PrimaryButton label="Next" onPress={next} disabled={!picked} />
    </View>
  );
}

export function WhosLikelyScreen() {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const [pick, setPick] = useState<'me' | 'them' | null>(null);
  const prompt = WHOS_MORE_LIKELY[index % WHOS_MORE_LIKELY.length];

  return (
    <View style={s.stack}>
      <Text style={[styles.kicker, { color: colors.accent }]}>WHO&apos;S MORE LIKELY TO…</Text>
      <Text style={[styles.prompt, { color: colors.text }]}>{prompt}</Text>
      <View style={styles.choiceRow}>
        {(
          [
            { id: 'me' as const, label: 'Me' },
            { id: 'them' as const, label: 'Them' },
          ] as const
        ).map((opt) => {
          const active = pick === opt.id;
          return (
            <Pressable
              key={opt.id}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setPick(opt.id);
              }}
              style={[
                styles.halfCard,
                {
                  backgroundColor: active ? colors.accentSoft : colors.surfaceElevated,
                  borderColor: active ? colors.accent : colors.border,
                },
              ]}>
              <Text style={[styles.choiceText, { color: colors.text }]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <PrimaryButton
        label="Reveal & next"
        onPress={() => {
          void Haptics.selectionAsync();
          setPick(null);
          setIndex((i) => i + 1);
        }}
        disabled={!pick}
      />
    </View>
  );
}

export function LoveQuizScreen() {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const item = LOVE_QUIZ[index % LOVE_QUIZ.length];

  return (
    <View style={s.stack}>
      <Text style={[styles.progress, { color: colors.textSecondary }]}>
        {index + 1} / {LOVE_QUIZ.length}
      </Text>
      <Text style={[styles.prompt, { color: colors.text }]}>{item.question}</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>{item.hint}</Text>
      <View style={[styles.note, { backgroundColor: colors.accentSoft }]}>
        <Text style={[styles.noteText, { color: colors.text }]}>
          One answers first. The other guesses. Say “match” out loud when you’re both ready.
        </Text>
      </View>
      <PrimaryButton
        label="Next question"
        onPress={() => {
          void Haptics.selectionAsync();
          setIndex((i) => i + 1);
        }}
      />
    </View>
  );
}

export function PromptListScreen({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const prompt = items[index % items.length];

  return (
    <View style={s.stack}>
      <Text style={[styles.kicker, { color: colors.accent }]}>{title}</Text>
      <Text style={[styles.prompt, { color: colors.text }]}>{prompt}</Text>
      <PrimaryButton
        label="Another"
        onPress={() => {
          void Haptics.selectionAsync();
          setIndex((i) => i + 1);
        }}
      />
    </View>
  );
}

export function EmojiStoryScreen() {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const [reveal, setReveal] = useState(false);
  const item = EMOJI_STORIES[index % EMOJI_STORIES.length];

  return (
    <View style={s.stack}>
      <Text style={[styles.kicker, { color: colors.accent }]}>GUESS THE STORY</Text>
      <Text style={styles.emojiPrompt}>{item.prompt}</Text>
      {reveal ? (
        <Text style={[styles.prompt, { color: colors.text }]}>{item.answer}</Text>
      ) : (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          One partner invents the story. The other guesses — then reveal.
        </Text>
      )}
      <PrimaryButton
        label={reveal ? 'Next story' : 'Reveal'}
        onPress={() => {
          void Haptics.selectionAsync();
          if (reveal) {
            setReveal(false);
            setIndex((i) => i + 1);
          } else {
            setReveal(true);
          }
        }}
      />
    </View>
  );
}

export function FortuneWheelScreen() {
  const { colors } = useTheme();
  const [result, setResult] = useState(() => pickFortune());

  return (
    <View style={s.stack}>
      <Text style={[styles.kicker, { color: colors.accent }]}>LOVE FORTUNE</Text>
      <View style={[styles.wheelResult, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
        <Text style={[styles.prompt, { color: colors.text }]}>{result}</Text>
      </View>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>Do it now — then spin again.</Text>
      <PrimaryButton
        label="Spin again"
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setResult(pickFortune());
        }}
      />
    </View>
  );
}

export function WeekChallengeScreen() {
  const { colors } = useTheme();
  const [done, setDone] = useState<Record<number, boolean>>({});

  return (
    <View style={s.stack}>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Check off a day when you finish. Come back tomorrow for the next one.
      </Text>
      {WEEK_CHALLENGE.map((day) => {
        const complete = !!done[day.day];
        return (
          <Pressable
            key={day.day}
            onPress={() => {
              void Haptics.selectionAsync();
              setDone((d) => ({ ...d, [day.day]: !complete }));
            }}
            style={[
              styles.dayRow,
              {
                backgroundColor: complete ? colors.accentSoft : colors.surfaceElevated,
                borderColor: complete ? colors.accent : colors.border,
              },
            ]}>
            <Text style={[styles.dayNum, { color: colors.accent }]}>Day {day.day}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dayTitle, { color: colors.text }]}>{day.title}</Text>
              <Text style={[styles.dayDetail, { color: colors.textSecondary }]}>{day.detail}</Text>
            </View>
            <Text style={{ color: colors.accent, fontWeight: '800' }}>{complete ? '✓' : ''}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DateNightChallengeScreen() {
  const { colors } = useTheme();
  const [done, setDone] = useState<Record<string, boolean>>({});

  return (
    <View style={s.stack}>
      {DATE_NIGHT_CHALLENGE.map((item) => {
        const complete = !!done[item.title];
        return (
          <Pressable
            key={item.title}
            onPress={() => {
              void Haptics.selectionAsync();
              setDone((d) => ({ ...d, [item.title]: !complete }));
            }}
            style={[
              styles.dayRow,
              {
                backgroundColor: complete ? colors.accentSoft : colors.surfaceElevated,
                borderColor: complete ? colors.accent : colors.border,
              },
            ]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.dayTitle, { color: colors.text }]}>{item.title}</Text>
              <Text style={[styles.dayDetail, { color: colors.textSecondary }]}>{item.detail}</Text>
            </View>
            <Text style={{ color: colors.accent, fontWeight: '800' }}>{complete ? '✓' : ''}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DateGeneratorScreen() {
  const { colors } = useTheme();
  const [idea, setIdea] = useState(() => pickRandomDateIdea());

  return (
    <View style={s.stack}>
      <Text style={[styles.kicker, { color: colors.accent }]}>YOUR NEXT DATE</Text>
      <Text style={[styles.prompt, { color: colors.text }]}>{idea.title}</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>{idea.description}</Text>
      <Text style={[styles.meta, { color: colors.textTertiary }]}>
        {idea.vibe} · {idea.cost} · {idea.duration}
      </Text>
      <PrimaryButton
        label="Shake for another"
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          setIdea(pickRandomDateIdea());
        }}
      />
    </View>
  );
}

type QuizQuestion = {
  question: string;
  options: { label: string; value: string }[];
};

function MultipleChoiceQuizScreen({
  questions,
  doneTitle,
  doneHint,
}: {
  questions: QuizQuestion[];
  doneTitle: string;
  doneHint: string;
}) {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const done = index >= questions.length;

  if (done) {
    return (
      <View style={s.stack}>
        <Text style={[styles.prompt, { color: colors.text }]}>{doneTitle}</Text>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>{doneHint}</Text>
        <PrimaryButton
          label="Start over"
          onPress={() => {
            setIndex(0);
          }}
        />
      </View>
    );
  }

  const q = questions[index];
  return (
    <View style={s.stack}>
      <Text style={[styles.progress, { color: colors.textSecondary }]}>
        {index + 1} / {questions.length}
      </Text>
      <Text style={[styles.prompt, { color: colors.text }]}>{q.question}</Text>
      {q.options.map((opt) => (
        <Pressable
          key={opt.value}
          onPress={() => {
            void Haptics.selectionAsync();
            setIndex((i) => i + 1);
          }}
          style={[styles.choiceCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[styles.choiceText, { color: colors.text }]}>{opt.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function CompatibilityScreen() {
  return (
    <MultipleChoiceQuizScreen
      questions={COMPATIBILITY_QUESTIONS}
      doneTitle="Nice — you both have a map now."
      doneHint="Talk through where you matched and where you differ. Differences aren’t failures — they’re planning fuel."
    />
  );
}

export function PersonalityScreen() {
  return (
    <MultipleChoiceQuizScreen
      questions={PERSONALITY_QUESTIONS}
      doneTitle="That’s your vibe snapshot."
      doneHint="Compare answers — notice what surprised you. Use it to plan dates and downtime that fit both of you."
    />
  );
}

export function AttachmentScreen() {
  return (
    <MultipleChoiceQuizScreen
      questions={ATTACHMENT_QUESTIONS}
      doneTitle="You’ve mapped how you connect."
      doneHint="No style is “wrong.” Share what helps you feel safe — reassurance, space, or steady check-ins."
    />
  );
}

export function DrawTogetherScreen() {
  const { colors } = useTheme();
  const prompts = ['Your dream house', 'Me', 'Our first date', 'A cat we would adopt'];
  const [index, setIndex] = useState(0);

  return (
    <View style={s.stack}>
      <Text style={[styles.kicker, { color: colors.accent }]}>DRAW TOGETHER</Text>
      <Text style={[styles.prompt, { color: colors.text }]}>Draw: {prompts[index % prompts.length]}</Text>
      <View style={[styles.canvas, { borderColor: colors.border, backgroundColor: colors.surfaceElevated }]}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Use paper (or any sketch app). Reveal at the same time — no peeking.
        </Text>
      </View>
      <PrimaryButton
        label="New prompt"
        onPress={() => {
          void Haptics.selectionAsync();
          setIndex((i) => i + 1);
        }}
      />
    </View>
  );
}

export function GuessAnswerScreen() {
  const { colors } = useTheme();
  return (
    <View style={s.stack}>
      <Text style={[styles.prompt, { color: colors.text }]}>Partner types an answer. You guess.</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Try: favorite dessert, dream city, or “what I want for dinner.” Hide the screen, then reveal.
      </Text>
      <View style={[styles.note, { backgroundColor: colors.accentSoft }]}>
        <Text style={[styles.noteText, { color: colors.text }]}>
          Tip: keep a running score for the night — loser plans the next date.
        </Text>
      </View>
    </View>
  );
}

export function NeverHaveIScreen() {
  return <PromptListScreen title="NEVER HAVE I EVER…" items={GAMES.find((g) => g.name === 'Never Have I Ever')?.rounds.map((r) => r.prompt) ?? []} />;
}

export function FinishSentenceScreen() {
  return <PromptListScreen title="FINISH THE SENTENCE" items={FINISH_THE_SENTENCE} />;
}

export function AppreciationScreen() {
  return <PromptListScreen title="APPRECIATION" items={APPRECIATION_PROMPTS} />;
}

export function ThirtySixScreen() {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const unlocked = Math.min(index + 1, THIRTY_SIX_QUESTIONS.length);

  return (
    <View style={s.stack}>
      <Text style={[styles.progress, { color: colors.textSecondary }]}>
        Question {unlocked} of {THIRTY_SIX_QUESTIONS.length}
      </Text>
      <Text style={[styles.prompt, { color: colors.text }]}>{THIRTY_SIX_QUESTIONS[index]}</Text>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Take turns. Unlock the next one only when you’re both ready.
      </Text>
      <PrimaryButton
        label={index + 1 >= THIRTY_SIX_QUESTIONS.length ? 'Start over' : 'Unlock next'}
        onPress={() => {
          void Haptics.selectionAsync();
          setIndex((i) => (i + 1 >= THIRTY_SIX_QUESTIONS.length ? 0 : i + 1));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  progress: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4 },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  prompt: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3, lineHeight: 30 },
  hint: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  meta: { fontSize: 12, fontWeight: '600' },
  choiceCol: { gap: 10 },
  choiceRow: { flexDirection: 'row', gap: 10 },
  choiceCard: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  halfCard: {
    flex: 1,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 28,
    alignItems: 'center',
  },
  choiceText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  note: { borderRadius: 16, padding: 14 },
  noteText: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  emojiPrompt: { fontSize: 40, textAlign: 'center', marginVertical: 12 },
  wheelResult: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 28,
    alignItems: 'center',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  dayNum: { fontSize: 12, fontWeight: '800', width: 48 },
  dayTitle: { fontSize: 15, fontWeight: '800' },
  dayDetail: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  canvas: {
    minHeight: 160,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});
