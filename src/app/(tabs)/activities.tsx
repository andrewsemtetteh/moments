import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { AppHeader } from '@/components/layout/AppHeader';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { TabScreenScroll } from '@/components/layout/TabScreenScroll';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Card, Chip, PrimaryButton, SectionTitle } from '@/components/ui/primitives';
import {
    CARD_CATEGORIES,
    CARD_PROMPTS,
    DATE_IDEAS,
    GAMES,
    LOVE_LANGUAGE_QUIZ,
} from '@/constants/activity-content';
import { MOOD_EMOJI } from '@/constants/design-system';
import {
    useBucketList,
    useBucketMutations,
    useDailyChallenge,
    useExperiences,
    useGenerateActivity,
    useGoalMutations,
    useRealtimeSubscription,
    useSharedGoals,
} from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { getDailyAiUsage, incrementDailyAiUsage } from '@/lib/usage-limits';
import * as api from '@/services/api';
import { useRelationshipStore } from '@/stores';

type ModalKey = 'cards' | 'games' | 'quiz' | 'bucket' | 'goals' | 'dates' | 'experiences' | null;

const CATEGORIES: { id: Exclude<ModalKey, null>; title: string; desc: string; icon: IconName }[] = [
  { id: 'cards', title: 'Conversation Cards', desc: 'Deep, funny & romantic prompts', icon: 'cards' },
  { id: 'games', title: 'Mini Games', desc: 'Would you rather, this or that…', icon: 'gamepad' },
  { id: 'quiz', title: 'Compatibility Quiz', desc: 'Discover your love language', icon: 'heart' },
  { id: 'dates', title: 'Date Planner', desc: 'Home, outdoor & virtual dates', icon: 'compass' },
  { id: 'bucket', title: 'Bucket List', desc: 'Dreams to chase together', icon: 'list' },
  { id: 'goals', title: 'Shared Goals', desc: 'Track progress as a team', icon: 'target' },
  { id: 'experiences', title: 'Experiences', desc: 'Curated real-world ideas', icon: 'star' },
];

export default function ActivitiesScreen() {
  const { colors } = useTheme();
  const relationship = useRelationshipStore((s) => s.relationship);
  const { data: challenge } = useDailyChallenge();
  const generateActivity = useGenerateActivity();
  const { limits } = useSubscription();
  const { requirePlus } = usePlusGate();
  const [aiUsedToday, setAiUsedToday] = useState(0);

  const refreshAiUsage = useCallback(async () => {
    setAiUsedToday(await getDailyAiUsage());
  }, []);

  useEffect(() => {
    void refreshAiUsage();
  }, [refreshAiUsage]);

  const aiRemaining = Number.isFinite(limits.aiRequests) ? Math.max(0, limits.aiRequests - aiUsedToday) : Infinity;
  const atAiLimit = Number.isFinite(limits.aiRequests) && aiUsedToday >= limits.aiRequests;

  const [mood, setMood] = useState('calm');
  const [timeAvailable, setTimeAvailable] = useState(2);
  const [budget, setBudget] = useState(50);
  const [suggestions, setSuggestions] = useState<Array<{ title: string; type: string; description?: string }>>([]);
  const [activeModal, setActiveModal] = useState<ModalKey>(null);

  useRealtimeSubscription('activities');

  const handleGenerate = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (atAiLimit && !requirePlus('Unlimited AI activity ideas')) return;

    try {
      const result = await generateActivity.mutateAsync({ mood, budget, time_available: timeAvailable });
      setSuggestions(result.activities);
      if (Number.isFinite(limits.aiRequests)) {
        const next = await incrementDailyAiUsage();
        setAiUsedToday(next);
      }
    } catch {
      setSuggestions([
        { title: 'Sunset walk together', type: 'outdoor', description: 'A 20-min walk sharing highlights of your day' },
        { title: 'Cook a new recipe', type: 'home', description: 'Pick something neither of you has tried' },
        { title: 'Memory lane chat', type: 'conversation', description: 'Share your favorite moment this month' },
      ]);
    }
  };

  const addToCalendar = async (title: string) => {
    if (!relationship) return;
    await api.createCalendarEvent(relationship.id, {
      title,
      date_time: new Date(Date.now() + 86400000).toISOString(),
      type: 'date',
      source: 'activity',
      description: null,
    });
    Alert.alert('Added to calendar', `"${title}" is planned for tomorrow. Edit the time in Calendar.`);
  };

  return (
    <ScreenContainer padded={false}>
      <AppHeader />
      <TabScreenScroll showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {challenge && (
          <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.challenge}>
            <Text style={styles.challengeLabel}>TODAY&apos;S CHALLENGE</Text>
            <Text style={styles.challengeText}>{challenge.prompt}</Text>
          </LinearGradient>
        )}

        {/* Generator */}
        <Card style={styles.generator}>
          <View style={styles.genHeader}>
            <Icon name="dice" size={22} color={colors.accent} />
            <Text style={[styles.genTitle, { color: colors.text }]}>We&apos;re bored</Text>
          </View>
          <Text style={[styles.genSub, { color: colors.textSecondary }]}>Tell us the vibe and we&apos;ll plan it</Text>
          {Number.isFinite(limits.aiRequests) && (
            <Text style={[styles.limitHint, { color: colors.textTertiary }]}>
              {aiRemaining} of {limits.aiRequests} AI suggestions left today
            </Text>
          )}

          <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Mood</Text>
          <View style={styles.moodRow}>
            {Object.entries(MOOD_EMOJI).map(([key, emoji]) => (
              <Pressable
                key={key}
                onPress={() => setMood(key)}
                style={[styles.moodChip, { backgroundColor: mood === key ? colors.accentSoft : colors.surfaceElevated, borderColor: mood === key ? colors.accent : 'transparent' }]}>
                <Text style={styles.moodEmoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.stepperRow}>
            <Stepper label="Time" value={`${timeAvailable}h`} onMinus={() => setTimeAvailable(Math.max(1, timeAvailable - 1))} onPlus={() => setTimeAvailable(Math.min(12, timeAvailable + 1))} colors={colors} />
            <Stepper label="Budget" value={`$${budget}`} onMinus={() => setBudget(Math.max(0, budget - 25))} onPlus={() => setBudget(budget + 25)} colors={colors} />
          </View>

          <PrimaryButton
            label={generateActivity.isPending ? 'Finding ideas…' : 'Find something for us'}
            onPress={handleGenerate}
            loading={generateActivity.isPending}
            style={{ marginTop: 14 }}
          />

          {suggestions.length > 0 && (
            <View style={styles.suggestions}>
              {suggestions.map((s, i) => (
                <View key={i} style={[styles.suggestionCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.suggestionTitle, { color: colors.text }]}>{s.title}</Text>
                    {s.description && <Text style={[styles.suggestionDesc, { color: colors.textSecondary }]}>{s.description}</Text>}
                    <Text style={[styles.suggestionType, { color: colors.accent }]}>{s.type}</Text>
                  </View>
                  <Pressable onPress={() => addToCalendar(s.title)} style={[styles.addBtn, { borderColor: colors.accent }]}>
                    <Icon name="plus" size={18} color={colors.accent} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </Card>

        <View style={{ marginTop: 22 }}>
          <SectionTitle>Explore</SectionTitle>
          <View style={styles.grid}>
            {CATEGORIES.map((cat) => (
              <Pressable
                key={cat.id}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveModal(cat.id);
                }}
                style={[styles.categoryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={[styles.catIcon, { backgroundColor: colors.accentSoft }]}>
                  <Icon name={cat.icon} size={22} color={colors.accent} />
                </View>
                <Text style={[styles.categoryTitle, { color: colors.text }]}>{cat.title}</Text>
                <Text style={[styles.categoryDesc, { color: colors.textSecondary }]}>{cat.desc}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </TabScreenScroll>

      <ActivityModal activeModal={activeModal} onClose={() => setActiveModal(null)} onAddToCalendar={addToCalendar} />
    </ScreenContainer>
  );
}

function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  colors,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[styles.stepper, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <Text style={[styles.stepperLabel, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.stepperControls}>
        <Pressable onPress={onMinus} style={[styles.stepBtn, { borderColor: colors.border }]}>
          <Icon name="chevronLeft" size={16} color={colors.text} />
        </Pressable>
        <Text style={[styles.stepperValue, { color: colors.text }]}>{value}</Text>
        <Pressable onPress={onPlus} style={[styles.stepBtn, { borderColor: colors.border }]}>
          <Icon name="chevronRight" size={16} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

/* ---------------- Activity Modal ---------------- */

function ActivityModal({
  activeModal,
  onClose,
  onAddToCalendar,
}: {
  activeModal: ModalKey;
  onClose: () => void;
  onAddToCalendar: (title: string) => void;
}) {
  const { colors } = useTheme();
  if (!activeModal) return null;

  const titles: Record<Exclude<ModalKey, null>, string> = {
    cards: 'Conversation Cards',
    games: 'Mini Games',
    quiz: 'Love Language Quiz',
    bucket: 'Bucket List',
    goals: 'Shared Goals',
    dates: 'Date Planner',
    experiences: 'Experiences',
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.text }]}>{titles[activeModal]}</Text>
          <Pressable onPress={onClose} style={[styles.closeBtn, { backgroundColor: colors.surfaceElevated }]}>
            <Icon name="close" size={20} color={colors.text} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
          {activeModal === 'cards' && <CardsDeck />}
          {activeModal === 'games' && <GamesPlayer />}
          {activeModal === 'quiz' && <Quiz />}
          {activeModal === 'bucket' && <BucketList />}
          {activeModal === 'goals' && <Goals />}
          {activeModal === 'dates' && <DatePlanner onAdd={onAddToCalendar} />}
          {activeModal === 'experiences' && <Experiences onAdd={onAddToCalendar} />}
        </ScrollView>
      </View>
    </Modal>
  );
}

function CardsDeck() {
  const { colors } = useTheme();
  const [category, setCategory] = useState<string>('deep');
  const [prompt, setPrompt] = useState(() => CARD_PROMPTS.deep[0]);

  const shuffle = (cat = category) => {
    const list = CARD_PROMPTS[cat] ?? CARD_PROMPTS.deep;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPrompt(list[Math.floor(Math.random() * list.length)]);
  };

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.chipsWrap}>
        {CARD_CATEGORIES.map((c) => (
          <Chip key={c} label={c} active={category === c} onPress={() => { setCategory(c); shuffle(c); }} />
        ))}
      </View>
      <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.deckCard}>
        <Icon name="cards" size={28} color="#fff" />
        <Text style={styles.deckPrompt}>{prompt}</Text>
      </LinearGradient>
      <PrimaryButton label="Shuffle another" onPress={() => shuffle()} />
    </View>
  );
}

function GamesPlayer() {
  const { colors } = useTheme();
  const [game, setGame] = useState<(typeof GAMES)[number] | null>(null);
  const [index, setIndex] = useState(0);
  const [reveal, setReveal] = useState(false);

  if (!game) {
    return (
      <View style={{ gap: 12 }}>
        {GAMES.map((g) => (
          <Pressable
            key={g.name}
            onPress={() => { setGame(g); setIndex(0); setReveal(false); }}
            style={[styles.gameItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={styles.gameEmoji}>{g.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.gameName, { color: colors.text }]}>{g.name}</Text>
              <Text style={[styles.gameDesc, { color: colors.textSecondary }]}>{g.desc}</Text>
            </View>
            <Icon name="chevronRight" size={20} color={colors.textTertiary} />
          </Pressable>
        ))}
      </View>
    );
  }

  const item = game.rounds[index % game.rounds.length];
  const next = () => { Haptics.selectionAsync(); setReveal(false); setIndex((i) => i + 1); };

  return (
    <View style={{ gap: 16 }}>
      <Pressable onPress={() => setGame(null)} style={styles.backRow}>
        <Icon name="chevronLeft" size={18} color={colors.accent} />
        <Text style={{ color: colors.accent, fontWeight: '600' }}>All games</Text>
      </Pressable>

      <Text style={[styles.gameHeading, { color: colors.text }]}>{game.emoji} {game.name}</Text>

      <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gameCard}>
        <Text style={styles.gameRoundNum}>Round {index + 1}</Text>
        <Text style={styles.gamePrompt}>{item.prompt}</Text>
        {item.options && (
          <View style={styles.optionsRow}>
            {item.options.map((opt) => (
              <View key={opt} style={styles.optionPill}>
                <Text style={styles.optionText}>{opt}</Text>
              </View>
            ))}
          </View>
        )}
        {item.answer && reveal && <Text style={styles.gameAnswer}>{item.answer}</Text>}
      </LinearGradient>

      {item.answer && !reveal ? (
        <PrimaryButton label="Reveal answer" onPress={() => setReveal(true)} />
      ) : (
        <PrimaryButton label="Next round" onPress={next} />
      )}
    </View>
  );
}

function Quiz() {
  const { colors } = useTheme();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [done, setDone] = useState(false);

  const result = (() => {
    const counts: Record<string, number> = {};
    Object.values(answers).forEach((a) => { counts[a] = (counts[a] ?? 0) + 1; });
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
    return top ? LOVE_LANGUAGE_QUIZ.results[top[0]] : null;
  })();

  if (done && result) {
    return (
      <View style={{ gap: 16 }}>
        <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.resultCard}>
          <Icon name="heart" size={30} color="#fff" filled />
          <Text style={styles.resultTitle}>{result.title}</Text>
          <Text style={styles.resultDesc}>{result.description}</Text>
        </LinearGradient>
        <PrimaryButton label="Retake quiz" onPress={() => { setAnswers({}); setDone(false); }} />
      </View>
    );
  }

  const allAnswered = Object.keys(answers).length === LOVE_LANGUAGE_QUIZ.questions.length;

  return (
    <View style={{ gap: 18 }}>
      {LOVE_LANGUAGE_QUIZ.questions.map((q, qi) => (
        <View key={qi} style={{ gap: 10 }}>
          <Text style={[styles.quizQ, { color: colors.text }]}>{qi + 1}. {q.question}</Text>
          {q.options.map((opt) => {
            const selected = answers[qi] === opt.value;
            return (
              <Pressable
                key={opt.label}
                onPress={() => setAnswers((a) => ({ ...a, [qi]: opt.value }))}
                style={[styles.quizOption, { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.border }]}>
                <Text style={{ color: colors.text, flex: 1 }}>{opt.label}</Text>
                {selected && <Icon name="check" size={18} color={colors.accent} />}
              </Pressable>
            );
          })}
        </View>
      ))}
      <PrimaryButton label="See result" onPress={() => setDone(true)} disabled={!allAnswered} />
    </View>
  );
}

function BucketList() {
  const { colors } = useTheme();
  const { data: items } = useBucketList();
  const { create, toggle } = useBucketMutations();
  const [text, setText] = useState('');

  const add = () => {
    if (!text.trim()) return;
    create.mutate(text.trim());
    setText('');
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.addRow}>
        <TextInput
          style={[styles.addInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          placeholder="Add a dream… (e.g. See the northern lights)"
          placeholderTextColor={colors.textTertiary}
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
        />
        <Pressable onPress={add} style={[styles.addCircle, { backgroundColor: colors.accent }]}>
          <Icon name="plus" size={22} color={colors.onAccent} />
        </Pressable>
      </View>
      {(items ?? []).map((item) => (
        <Pressable
          key={item.id}
          onPress={() => toggle.mutate({ id: item.id, status: item.status })}
          style={[styles.bucketItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.checkbox, { borderColor: item.status === 'completed' ? colors.success : colors.border, backgroundColor: item.status === 'completed' ? colors.success : 'transparent' }]}>
            {item.status === 'completed' && <Icon name="check" size={14} color="#fff" />}
          </View>
          <Text style={{ color: colors.text, flex: 1, textDecorationLine: item.status === 'completed' ? 'line-through' : 'none' }}>
            {item.title}
          </Text>
        </Pressable>
      ))}
      {(items ?? []).length === 0 && <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 12 }}>No dreams yet — add your first one above.</Text>}
    </View>
  );
}

function Goals() {
  const { colors } = useTheme();
  const { data: goals } = useSharedGoals();
  const { create, updateProgress } = useGoalMutations();
  const [text, setText] = useState('');

  const add = () => {
    if (!text.trim()) return;
    create.mutate(text.trim());
    setText('');
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.addRow}>
        <TextInput
          style={[styles.addInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
          placeholder="Add a goal… (e.g. Save for a trip)"
          placeholderTextColor={colors.textTertiary}
          value={text}
          onChangeText={setText}
          onSubmitEditing={add}
        />
        <Pressable onPress={add} style={[styles.addCircle, { backgroundColor: colors.accent }]}>
          <Icon name="plus" size={22} color={colors.onAccent} />
        </Pressable>
      </View>
      {(goals ?? []).map((g) => (
        <View key={g.id} style={[styles.goalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.goalHeader}>
            <Text style={{ color: colors.text, fontWeight: '700', flex: 1 }}>{g.title}</Text>
            <Text style={{ color: colors.accent, fontWeight: '800' }}>{g.progress}%</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.surfaceElevated }]}>
            <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${Math.min(100, g.progress)}%` }]} />
          </View>
          <View style={styles.goalControls}>
            <Pressable onPress={() => updateProgress.mutate({ id: g.id, progress: Math.max(0, g.progress - 10) })} style={[styles.goalBtn, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text }}>-10%</Text>
            </Pressable>
            <Pressable onPress={() => updateProgress.mutate({ id: g.id, progress: Math.min(100, g.progress + 10) })} style={[styles.goalBtn, { borderColor: colors.border }]}>
              <Text style={{ color: colors.text }}>+10%</Text>
            </Pressable>
          </View>
        </View>
      ))}
      {(goals ?? []).length === 0 && <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 12 }}>No goals yet — set one together.</Text>}
    </View>
  );
}

function DatePlanner({ onAdd }: { onAdd: (title: string) => void }) {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<string>('all');
  const types = ['all', 'home', 'outdoor', 'virtual', 'special'];
  const ideas = filter === 'all' ? DATE_IDEAS : DATE_IDEAS.filter((d) => d.type === filter);

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.chipsWrap}>
        {types.map((t) => <Chip key={t} label={t} active={filter === t} onPress={() => setFilter(t)} />)}
      </View>
      {ideas.map((idea) => (
        <View key={idea.title} style={[styles.dateCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={styles.dateEmoji}>{idea.emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.dateTitle, { color: colors.text }]}>{idea.title}</Text>
            <Text style={[styles.dateDesc, { color: colors.textSecondary }]}>{idea.description}</Text>
            <Text style={[styles.dateMeta, { color: colors.accent }]}>{idea.vibe} · {idea.cost} · {idea.duration}</Text>
          </View>
          <Pressable onPress={() => onAdd(idea.title)} style={[styles.addBtn, { borderColor: colors.accent }]}>
            <Icon name="calendar" size={18} color={colors.accent} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

function Experiences({ onAdd }: { onAdd: (title: string) => void }) {
  const { colors } = useTheme();
  const { data: experiences } = useExperiences();

  if (!experiences || experiences.length === 0) {
    return <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 20 }}>No experiences available yet. Check back soon.</Text>;
  }

  return (
    <View style={{ gap: 12 }}>
      {experiences.map((exp) => (
        <View key={exp.id} style={[styles.expCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.expTitle, { color: colors.text }]}>{exp.title}</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13, marginTop: 2 }}>
              {[exp.type, exp.location, exp.price_range].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Pressable onPress={() => onAdd(exp.title)} style={[styles.addBtn, { borderColor: colors.accent }]}>
            <Icon name="calendar" size={18} color={colors.accent} />
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16 },
  challenge: { borderRadius: 20, padding: 18, marginBottom: 18 },
  challengeLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  challengeText: { color: '#fff', fontSize: 18, lineHeight: 25, fontWeight: '600', marginTop: 8 },
  generator: {},
  genHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  genTitle: { fontSize: 19, fontWeight: '800' },
  genSub: { fontSize: 13, marginTop: 2, marginBottom: 4 },
  limitHint: { fontSize: 12, fontWeight: '600', marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  moodRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  moodChip: { padding: 9, borderRadius: 12, borderWidth: 1.5 },
  moodEmoji: { fontSize: 22 },
  stepperRow: { flexDirection: 'row', gap: 12 },
  stepper: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  stepperLabel: { fontSize: 12, fontWeight: '600', marginBottom: 8 },
  stepperControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepperValue: { fontSize: 16, fontWeight: '800' },
  suggestions: { gap: 10, marginTop: 16 },
  suggestionCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  suggestionTitle: { fontSize: 15, fontWeight: '700' },
  suggestionDesc: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  suggestionType: { fontSize: 11, marginTop: 6, textTransform: 'uppercase', fontWeight: '700', letterSpacing: 0.5 },
  addBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  categoryCard: { width: '47%', flexGrow: 1, minWidth: 150, padding: 16, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth },
  catIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  categoryTitle: { fontSize: 15, fontWeight: '700' },
  categoryDesc: { fontSize: 12, marginTop: 3, lineHeight: 16 },
  // modal
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 20, borderBottomWidth: StyleSheet.hairlineWidth },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 16, paddingBottom: 40 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  deckCard: { borderRadius: 22, padding: 26, minHeight: 200, justifyContent: 'space-between' },
  deckPrompt: { color: '#fff', fontSize: 24, fontWeight: '700', lineHeight: 32, marginTop: 16 },
  gameItem: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  gameEmoji: { fontSize: 26 },
  gameName: { fontSize: 16, fontWeight: '700' },
  gameDesc: { fontSize: 13, marginTop: 2 },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gameHeading: { fontSize: 20, fontWeight: '800' },
  gameCard: { borderRadius: 22, padding: 24, minHeight: 220, justifyContent: 'center', gap: 12 },
  gameRoundNum: { color: 'rgba(255,255,255,0.8)', fontWeight: '700', fontSize: 12, letterSpacing: 1 },
  gamePrompt: { color: '#fff', fontSize: 23, fontWeight: '700', lineHeight: 31 },
  optionsRow: { gap: 10, marginTop: 8 },
  optionPill: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: 14 },
  optionText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  gameAnswer: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 8 },
  resultCard: { borderRadius: 22, padding: 26, alignItems: 'center', gap: 10 },
  resultTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 6 },
  resultDesc: { color: 'rgba(255,255,255,0.92)', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  quizQ: { fontSize: 16, fontWeight: '700', lineHeight: 22 },
  quizOption: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 1.5 },
  addRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  addInput: { flex: 1, borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 15 },
  addCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  bucketItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  goalCard: { padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  goalHeader: { flexDirection: 'row', alignItems: 'center' },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: 4 },
  goalControls: { flexDirection: 'row', gap: 10 },
  goalBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  dateCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  dateEmoji: { fontSize: 28 },
  dateTitle: { fontSize: 15, fontWeight: '700' },
  dateDesc: { fontSize: 13, marginTop: 2, lineHeight: 18 },
  dateMeta: { fontSize: 11, marginTop: 6, fontWeight: '700', textTransform: 'capitalize' },
  expCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  expTitle: { fontSize: 15, fontWeight: '700' },
});
