import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import {
    CARD_CATEGORIES,
    CARD_PROMPTS,
    COUPLES_TRIVIA,
    DAILY_QUESTIONS,
    GAMES,
    LOVE_LANGUAGE_QUIZ,
    getDailyQuestion,
} from '@/constants/activity-content';
import { useBucketList, useBucketMutations, useGoalMutations, useSharedGoals } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { useRelationshipStore } from '@/stores';

import { exploreStyles as s } from './explore-styles';

const BUCKET_EMOJIS = ['✈️', '🌍', '🏔️', '🎢', '🏖️', '🎭', '🍜', '🚗', '💫', '🎸', '⛺', '🛳️'];

function bucketEmoji(index: number) {
  return BUCKET_EMOJIS[index % BUCKET_EMOJIS.length];
}

export function CardsDeckScreen() {
  const { colors } = useTheme();
  const [category, setCategory] = useState<string>('deep');
  const [prompt, setPrompt] = useState(() => CARD_PROMPTS.deep[0]);

  const shuffle = (cat = category) => {
    const list = CARD_PROMPTS[cat] ?? CARD_PROMPTS.deep;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrompt(list[Math.floor(Math.random() * list.length)]);
  };

  return (
    <View style={s.stack}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {CARD_CATEGORIES.map((c) => {
          const active = category === c;
          return (
            <Pressable
              key={c}
              onPress={() => {
                setCategory(c);
                shuffle(c);
              }}
              style={[
                s.tab,
                {
                  backgroundColor: active ? colors.text : colors.surfaceElevated,
                  borderColor: active ? colors.text : colors.border,
                },
              ]}>
              <Text style={[s.tabText, { color: active ? colors.background : colors.textSecondary }]}>
                {c.charAt(0).toUpperCase() + c.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.promptCard}>
        <Text style={s.quoteMark}>&ldquo;</Text>
        <Text style={s.promptText}>{prompt}</Text>
        <Text style={s.promptHint}>Take turns — answer honestly</Text>
      </LinearGradient>

      <PrimaryButton label="Another card" onPress={() => shuffle()} />
    </View>
  );
}

export function GamesPlayerScreen() {
  const { colors } = useTheme();
  const [game, setGame] = useState<(typeof GAMES)[number] | null>(null);
  const [index, setIndex] = useState(0);
  const [reveal, setReveal] = useState(false);

  if (!game) {
    return (
      <View style={s.stack}>
        {GAMES.map((g) => (
          <Pressable
            key={g.name}
            onPress={() => {
              Haptics.selectionAsync();
              setGame(g);
              setIndex(0);
              setReveal(false);
            }}
            style={[s.gameTile, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={s.gameTileEmoji}>{g.emoji}</Text>
            <View style={[s.gameTileAccent, { backgroundColor: colors.accent }]} />
            <View style={s.gameTileBody}>
              <Text style={[s.gameTileTitle, { color: colors.text }]}>{g.name}</Text>
              <Text style={[s.gameTileDesc, { color: colors.textSecondary }]}>{g.desc}</Text>
            </View>
            <Icon name="chevronRight" size={18} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>
    );
  }

  const item = game.rounds[index % game.rounds.length];
  const next = () => {
    Haptics.selectionAsync();
    setReveal(false);
    setIndex((i) => i + 1);
  };

  return (
    <View style={s.stack}>
      <Pressable onPress={() => setGame(null)} style={s.backLink}>
        <Icon name="chevronLeft" size={18} color={colors.accent} />
        <Text style={[s.backLinkText, { color: colors.accent }]}>All games</Text>
      </Pressable>

      <View style={s.roundHeader}>
        <Text style={[s.roundGame, { color: colors.text }]}>{game.emoji} {game.name}</Text>
        <Text style={[s.roundNum, { color: colors.textSecondary }]}>Round {index + 1}</Text>
      </View>

      <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.gamePlayCard}>
        <Text style={s.gamePrompt}>{item.prompt}</Text>
        {item.options && (
          <View style={s.optionsCol}>
            {item.options.map((opt) => (
              <View key={opt} style={s.optionPill}>
                <Text style={s.optionText}>{opt}</Text>
              </View>
            ))}
          </View>
        )}
        {item.answer && reveal && <Text style={s.gameAnswer}>{item.answer}</Text>}
      </LinearGradient>

      {item.answer && !reveal ? (
        <PrimaryButton label="Reveal answer" onPress={() => setReveal(true)} />
      ) : (
        <PrimaryButton label="Next round" onPress={next} />
      )}
    </View>
  );
}

export function QuizScreen() {
  const { colors } = useTheme();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [done, setDone] = useState(false);
  const total = LOVE_LANGUAGE_QUIZ.questions.length;
  const answered = Object.keys(answers).length;

  const result = (() => {
    const counts: Record<string, number> = {};
    Object.values(answers).forEach((a) => {
      counts[a] = (counts[a] ?? 0) + 1;
    });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? LOVE_LANGUAGE_QUIZ.results[top[0]] : null;
  })();

  if (done && result) {
    return (
      <View style={s.stack}>
        <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.resultCard}>
          <Icon name="heart" size={32} color="#fff" filled />
          <Text style={s.resultEyebrow}>Your love language</Text>
          <Text style={s.resultTitle}>{result.title}</Text>
          <Text style={s.resultDesc}>{result.description}</Text>
        </LinearGradient>
        <Text style={[s.resultShare, { color: colors.textSecondary }]}>
          Share your result with your partner and compare.
        </Text>
        <PrimaryButton label="Retake quiz" onPress={() => { setAnswers({}); setDone(false); }} />
      </View>
    );
  }

  return (
    <View style={s.stack}>
      <View style={s.progressWrap}>
        <View style={[s.progressTrack, { backgroundColor: colors.surfaceElevated }]}>
          <View style={[s.progressFill, { backgroundColor: colors.accent, width: `${(answered / total) * 100}%` }]} />
        </View>
        <Text style={[s.progressLabel, { color: colors.textSecondary }]}>
          {answered} of {total} answered
        </Text>
      </View>

      {LOVE_LANGUAGE_QUIZ.questions.map((q, qi) => (
        <View key={qi} style={[s.quizBlock, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[s.quizNum, { color: colors.accent }]}>Q{qi + 1}</Text>
          <Text style={[s.quizQ, { color: colors.text }]}>{q.question}</Text>
          <View style={s.quizOptions}>
            {q.options.map((opt) => {
              const selected = answers[qi] === opt.value;
              return (
                <Pressable
                  key={opt.label}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setAnswers((a) => ({ ...a, [qi]: opt.value }));
                  }}
                  style={[
                    s.quizOption,
                    {
                      backgroundColor: selected ? colors.accentSoft : colors.surface,
                      borderColor: selected ? colors.accent : colors.border,
                    },
                  ]}>
                  <Text style={[s.quizOptionText, { color: colors.text }]}>{opt.label}</Text>
                  {selected && <Icon name="check" size={18} color={colors.accent} />}
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <PrimaryButton label="See my result" onPress={() => setDone(true)} disabled={answered < total} />
    </View>
  );
}

export function BucketListScreen() {
  const { colors } = useTheme();
  const { data: items } = useBucketList();
  const { create, toggle } = useBucketMutations();
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const list = items ?? [];
  const filters = ['all', 'pending', 'completed'] as const;

  const filtered = list.filter((item) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return item.status === 'pending';
    return item.status === 'completed';
  });

  const add = () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    create.mutate(text.trim());
    setText('');
  };

  return (
    <View style={s.stack}>
      <View style={[s.inputCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <TextInput
          style={[s.input, { color: colors.text }]}
          placeholder="Northern lights, road trip, learn to surf…"
          placeholderTextColor={colors.textTertiary}
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
        />
        <Pressable onPress={add} style={[s.inputBtn, { backgroundColor: colors.accent }]}>
          <Icon name="plus" size={22} color={colors.onAccent} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {filters.map((t) => {
          const active = filter === t;
          return (
            <Pressable
              key={t}
              onPress={() => setFilter(t)}
              style={[
                s.tab,
                {
                  backgroundColor: active ? colors.text : colors.surfaceElevated,
                  borderColor: active ? colors.text : colors.border,
                },
              ]}>
              <Text style={[s.tabText, { color: active ? colors.background : colors.textSecondary }]}>
                {t === 'all' ? 'All' : t === 'pending' ? 'To do' : 'Done'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {filtered.length === 0 ? (
        <View style={[s.emptyCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={s.emptyEmoji}>✈️</Text>
          <Text style={[s.emptyTitle, { color: colors.text }]}>
            {list.length === 0 ? 'No dreams yet' : 'Nothing here'}
          </Text>
          <Text style={[s.emptySub, { color: colors.textSecondary }]}>
            {list.length === 0
              ? 'Add the trips, milestones, and adventures you want to share.'
              : 'Try another filter or add something new.'}
          </Text>
        </View>
      ) : (
        filtered.map((item, index) => {
          const done = item.status === 'completed';
          return (
            <View
              key={item.id}
              style={[s.dateCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={s.dateEmoji}>{bucketEmoji(index)}</Text>
              <View style={s.dateBody}>
                <Text style={[s.dateTitle, { color: colors.text }, done && s.listTextDone]}>{item.title}</Text>
                <Text style={[s.dateDesc, { color: colors.textSecondary }]}>
                  {item.note?.trim() || 'Something to look forward to together'}
                </Text>
                <Text style={[s.dateMeta, { color: colors.accent }]}>
                  {done ? 'Completed' : 'On your list'}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  toggle.mutate({ id: item.id, status: item.status });
                }}
                style={[
                  s.dateAdd,
                  {
                    backgroundColor: done ? colors.success : colors.accentSoft,
                    borderColor: done ? colors.success : colors.accent,
                  },
                ]}>
                <Icon name="check" size={18} color={done ? '#fff' : colors.accent} />
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );
}

export function GoalsScreen() {
  const { colors } = useTheme();
  const { data: goals } = useSharedGoals();
  const { create, updateProgress } = useGoalMutations();
  const [text, setText] = useState('');
  const list = goals ?? [];

  const add = () => {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    create.mutate(text.trim());
    setText('');
  };

  return (
    <View style={s.stack}>
      <View style={[s.inputCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <TextInput
          style={[s.input, { color: colors.text }]}
          placeholder="Save for a trip, run a 5K together…"
          placeholderTextColor={colors.textTertiary}
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
        />
        <Pressable onPress={add} style={[s.inputBtn, { backgroundColor: colors.accent }]}>
          <Icon name="plus" size={22} color={colors.onAccent} />
        </Pressable>
      </View>

      {list.length === 0 ? (
        <View style={[s.emptyCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={s.emptyEmoji}>🎯</Text>
          <Text style={[s.emptyTitle, { color: colors.text }]}>No shared goals yet</Text>
          <Text style={[s.emptySub, { color: colors.textSecondary }]}>
            Set something you want to build or achieve together.
          </Text>
        </View>
      ) : (
        list.map((g) => (
          <View key={g.id} style={[s.goalCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <View style={s.goalTop}>
              <Text style={[s.goalTitle, { color: colors.text }]}>{g.title}</Text>
              <Text style={[s.goalPct, { color: colors.accent }]}>{g.progress}%</Text>
            </View>
            <View style={[s.goalTrack, { backgroundColor: colors.surface }]}>
              <View style={[s.goalFill, { backgroundColor: colors.accent, width: `${Math.min(100, g.progress)}%` }]} />
            </View>
            <View style={s.goalBtns}>
              <Pressable
                onPress={() => updateProgress.mutate({ id: g.id, progress: Math.max(0, g.progress - 10) })}
                style={[s.goalBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>−10%</Text>
              </Pressable>
              <Pressable
                onPress={() => updateProgress.mutate({ id: g.id, progress: Math.min(100, g.progress + 10) })}
                style={[s.goalBtn, { borderColor: colors.accent, backgroundColor: colors.accentSoft }]}>
                <Text style={{ color: colors.accent, fontWeight: '800' }}>+10%</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  );
}

export function GratitudeSwapScreen() {
  const { colors } = useTheme();
  const partner = useRelationshipStore((s) => s.partner);
  const partnerName = getFirstName(partner?.name) ?? 'your partner';
  const [items, setItems] = useState(['', '', '']);

  const update = (index: number, value: string) => {
    setItems((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const submit = () => {
    const filled = items.map((t) => t.trim()).filter(Boolean);
    if (filled.length === 0) {
      Alert.alert('Add at least one', 'Write something you appreciated today.');
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Beautiful',
      `Share these with ${partnerName} — say them out loud or drop them in chat.`,
    );
    setItems(['', '', '']);
  };

  return (
    <View style={s.stack}>
      <Text style={[s.hintText, { color: colors.textSecondary }]}>
        What did {partnerName} do today that you appreciated?
      </Text>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[s.gratitudeRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
          <Text style={[s.gratitudeNum, { color: colors.accent }]}>{i + 1}</Text>
          <TextInput
            style={[s.gratitudeInput, { color: colors.text }]}
            placeholder={`Something ${i === 0 ? 'small' : i === 1 ? 'sweet' : 'meaningful'}…`}
            placeholderTextColor={colors.textTertiary}
            value={items[i]}
            onChangeText={(v) => update(i, v)}
            multiline
          />
        </View>
      ))}
      <PrimaryButton label="Ready to share" onPress={submit} />
    </View>
  );
}

export function QuestionOfDayScreen() {
  const { colors } = useTheme();
  const [question, setQuestion] = useState(() => getDailyQuestion());

  const shuffle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const others = DAILY_QUESTIONS.filter((q) => q !== question);
    setQuestion(others[Math.floor(Math.random() * others.length)] ?? getDailyQuestion());
  };

  return (
    <View style={s.stack}>
      <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.dailyCard}>
        <Text style={s.dailyLabel}>Today&apos;s question</Text>
        <Text style={s.dailyQuestion}>{question}</Text>
        <Text style={s.dailyHint}>Take turns — there&apos;s no wrong answer</Text>
      </LinearGradient>
      <PrimaryButton label="Another question" onPress={shuffle} />
    </View>
  );
}

export function CouplesTriviaScreen() {
  const { colors } = useTheme();
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const total = COUPLES_TRIVIA.length;
  const current = COUPLES_TRIVIA[index];

  const choose = (optionIndex: number) => {
    if (picked !== null) return;
    Haptics.selectionAsync();
    setPicked(optionIndex);
    if (optionIndex === current.answer) setScore((sc) => sc + 1);
  };

  const next = () => {
    if (index + 1 >= total) {
      setDone(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  };

  if (done) {
    const pct = Math.round((score / total) * 100);
    return (
      <View style={s.stack}>
        <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.resultCard}>
          <Text style={s.resultEyebrow}>Final score</Text>
          <Text style={s.resultTitle}>
            {score}/{total}
          </Text>
          <Text style={s.resultDesc}>
            {pct >= 80
              ? 'You two are in sync — relationship pros!'
              : pct >= 50
                ? 'Solid team — keep learning about each other.'
                : 'Great excuse for more date nights together.'}
          </Text>
        </LinearGradient>
        <PrimaryButton
          label="Play again"
          onPress={() => {
            setIndex(0);
            setScore(0);
            setPicked(null);
            setDone(false);
          }}
        />
      </View>
    );
  }

  return (
    <View style={s.stack}>
      <View style={s.progressWrap}>
        <View style={[s.progressTrack, { backgroundColor: colors.surfaceElevated }]}>
          <View
            style={[
              s.progressFill,
              { backgroundColor: colors.accent, width: `${((index + (picked !== null ? 1 : 0)) / total) * 100}%` },
            ]}
          />
        </View>
        <Text style={[s.progressLabel, { color: colors.textSecondary }]}>
          Question {index + 1} of {total}
        </Text>
      </View>

      <View style={[s.quizBlock, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Text style={[s.quizQ, { color: colors.text }]}>{current.question}</Text>
        <View style={s.quizOptions}>
          {current.options.map((opt, oi) => {
            const selected = picked === oi;
            const correct = picked !== null && oi === current.answer;
            const wrong = picked !== null && selected && oi !== current.answer;
            return (
              <Pressable
                key={opt}
                onPress={() => choose(oi)}
                style={[
                  s.quizOption,
                  {
                    backgroundColor: correct
                      ? colors.accentSoft
                      : wrong
                        ? 'rgba(255,80,80,0.12)'
                        : selected
                          ? colors.accentSoft
                          : colors.surface,
                    borderColor: correct ? colors.accent : wrong ? colors.error : colors.border,
                  },
                ]}>
                <Text style={[s.quizOptionText, { color: colors.text }]}>{opt}</Text>
                {correct && <Icon name="check" size={18} color={colors.accent} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      {picked !== null ? (
        <PrimaryButton label={index + 1 >= total ? 'See score' : 'Next question'} onPress={next} />
      ) : null}
    </View>
  );
}
