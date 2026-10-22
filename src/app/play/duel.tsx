import * as Haptics from '@/lib/haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { Confetti } from '@/components/games/Celebration';
import { AnswerShape } from '@/components/games/AnswerShape';
import { PromptCard } from '@/components/games/room-panels';
import { ChunkyButton, firstName, shade } from '@/components/games/room-ui';
import { PlayHeader } from '@/components/play/PlayHeader';
import { PLAY_GUTTER, PlayHero, PlayType, playCardStyle } from '@/components/play/PlayKit';
import { RivalryCard } from '@/components/play/Versus';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useLightStatusBar } from '@/hooks/useLightStatusBar';
import { useTheme } from '@/hooks/useTheme';
import { DUEL_SIZE, answerDuel, duelId, duelOpen, ensureDuel, getDuel, type DuelSession } from '@/lib/game-room/duel';
import { todayKey } from '@/lib/play-progress';
import { BOOL_TILE_COLORS, QUIZ_TILE_COLORS } from '@/lib/quiz-live';
import { useAuthStore, useRelationshipStore } from '@/stores';

const tone = PLAY_TONES.amber;

/** The daily duel: answer three questions, then see who knew more once you've both played. */
export default function DuelScreen() {
  const { date: dateParam } = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  useLightStatusBar();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const relationshipId = useRelationshipStore((s) => s.relationship?.id);
  const today = todayKey();
  const date = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const id = relationshipId ? duelId(relationshipId, date) : undefined;

  const me = { id: user?.id ?? '', name: user?.name ?? 'You' };
  const them = { id: partner?.id ?? '', name: partner?.name ?? 'Partner' };

  // Today's is created on first open; an older one is only read.
  const { data: duel, isLoading } = useQuery({
    queryKey: ['gameSession', id],
    queryFn: () => (date === today && user && partner ? ensureDuel(relationshipId!, me, them, date) : getDuel(id!)),
    enabled: !!id && !!user && !!partner,
  });

  const [picks, setPicks] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const submit = async (all: number[]) => {
    if (!id || !user || !partner) return;
    setSaving(true);
    try {
      const saved = await answerDuel(id, me, them, all);
      queryClient.setQueryData(['gameSession', id], saved);
    } catch (e) {
      setPicks([]);
      Alert.alert('Couldn’t save your answers', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setSaving(false);
    }
  };

  const choose = (index: number) => {
    if (saving) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = [...picks, index];
    setPicks(next);
    if (next.length === DUEL_SIZE) void submit(next);
  };

  const header = (
    <View style={{ backgroundColor: tone.accent }}>
      <PlayHeader title={date === today ? 'Today’s duel' : 'Yesterday’s duel'} onColor="#FFFFFF" />
    </View>
  );

  if (isLoading || !duel) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        {header}
        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={tone.accent} />
          </View>
        ) : (
          <EmptyState fill icon="trophy" title="No duel that day" text="A new one starts every day on Play." />
        )}
      </View>
    );
  }

  const state = duel.state;
  const answered = !!state.answers[me.id];
  const open = duelOpen(state.date, today);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        bounces={false}
        overScrollMode="never"
        stickyHeaderIndices={[0]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        {header}
        <PlayHero
          color={tone.accent}
          pill="Versus · 3 questions"
          blurb={
            state.result
              ? 'Here’s how you both did.'
              : answered
                ? `Locked in. The answers show once ${firstName(them.name)} plays.`
                : 'Same three questions for you both. One point each. No peeking.'
          }>
          {!answered && !state.result ? (
            <View style={styles.steps}>
              {Array.from({ length: DUEL_SIZE }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.step,
                    {
                      backgroundColor:
                        i < picks.length
                          ? '#FFFFFF'
                          : i === picks.length
                            ? 'rgba(255,255,255,0.7)'
                            : 'rgba(255,255,255,0.28)',
                    },
                  ]}
                />
              ))}
            </View>
          ) : null}
        </PlayHero>

        <View style={styles.body}>
          {state.result ? (
            <DuelResults duel={duel} meId={me.id} themId={them.id} onDone={() => router.back()} />
          ) : answered ? (
            <Waiting name={firstName(them.name)} onDone={() => router.back()} />
          ) : !open ? (
            <EmptyState
              icon="time"
              title="This duel has closed"
              text="Duels stay open until the end of the next day. Today’s is waiting on Play."
            />
          ) : saving || picks.length >= DUEL_SIZE ? (
            <View style={styles.centered}>
              <ActivityIndicator color={tone.accent} />
            </View>
          ) : (
            <Question duel={duel} index={picks.length} onPick={choose} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Question({ duel, index, onPick }: { duel: DuelSession; index: number; onPick: (i: number) => void }) {
  const q = duel.state.questions[index];
  const palette = q.options.length === 2 ? BOOL_TILE_COLORS : QUIZ_TILE_COLORS;
  return (
    <Animated.View style={styles.question} key={index} entering={FadeIn.duration(160)}>
      <PromptCard tone={tone} eyebrow={`QUESTION ${index + 1} OF ${DUEL_SIZE}`}>
        <Text style={styles.promptText}>{q.question}</Text>
      </PromptCard>
      <View style={styles.grid}>
        {q.options.map((opt, i) => {
          const color = palette[i % palette.length];
          return (
            <Pressable
              key={`${index}-${i}`}
              onPress={() => onPick(i)}
              accessibilityRole="button"
              accessibilityLabel={opt}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: color, borderBottomColor: shade(color, -0.3), borderBottomWidth: pressed ? 1 : 5 },
              ]}>
              <AnswerShape index={i} count={q.options.length} />
              <Text style={styles.tileText}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </Animated.View>
  );
}

function Waiting({ name, onDone }: { name: string; onDone: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.gap}>
      <View style={[styles.waitCard, playCardStyle(colors)]}>
        <Icon name="time" size={22} color={colors.textSecondary} />
        <Text style={[PlayType.body, styles.flex, { color: colors.textSecondary }]}>
          We’ve let {name} know it’s their turn. You’ll get a ping when the results are in.
        </Text>
      </View>
      <RivalryCard compact />
      <ChunkyButton label="Done" color={tone.accent} onPress={onDone} />
    </View>
  );
}

function DuelResults({
  duel,
  meId,
  themId,
  onDone,
}: {
  duel: DuelSession;
  meId: string;
  themId: string;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const state = duel.state;
  const result = state.result!;
  const mine = result.scores[meId] ?? 0;
  const theirs = result.scores[themId] ?? 0;
  const them = firstName(partner?.name);
  const headline =
    result.winnerId === meId ? 'You win today 🏆' : result.winnerId ? `${them} wins today 🏆` : 'A tie today 🤝';

  return (
    <View style={styles.gap}>
      {result.winnerId === meId ? <Confetti burstKey={duel.version} /> : null}
      <Text style={[styles.headline, { color: colors.text }]}>{headline}</Text>
      <View style={[styles.board, playCardStyle(colors)]}>
        <Row avatar={user?.avatar_url} label={user?.name} name="You" score={mine} crown={result.winnerId === meId} />
        <Row
          avatar={partner?.avatar_url}
          label={partner?.name}
          name={them}
          score={theirs}
          crown={result.winnerId === themId}
        />
      </View>

      {state.questions.map((q, i) => {
        const a = state.answers[meId]?.[i];
        const b = state.answers[themId]?.[i];
        return (
          <View key={i} style={[styles.answer, playCardStyle(colors)]}>
            <Text style={[PlayType.title, { color: colors.text }]}>{q.question}</Text>
            <Text style={[PlayType.body, { color: colors.success }]}>✓ {q.options[q.correctIndex]}</Text>
            <View style={styles.picks}>
              <Pick who="You" right={a === q.correctIndex} text={a !== undefined ? q.options[a] : '—'} />
              <Pick who={them} right={b === q.correctIndex} text={b !== undefined ? q.options[b] : '—'} />
            </View>
          </View>
        );
      })}

      <RivalryCard compact />
      <Text style={[PlayType.body, styles.center, { color: colors.textSecondary }]}>New questions tomorrow.</Text>
      <ChunkyButton label="Done" color={tone.accent} onPress={onDone} />
    </View>
  );
}

function Row({
  avatar,
  label,
  name,
  score,
  crown,
}: {
  avatar?: string | null;
  label?: string | null;
  name: string;
  score: number;
  crown: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Avatar name={label ?? name} imageUrl={avatar ?? undefined} size={36} />
      <Text style={[styles.rowName, { color: colors.text }]}>
        {name} {crown ? '👑' : ''}
      </Text>
      <Text style={[styles.rowScore, { color: colors.text }]}>
        {score}
        <Text style={{ color: colors.textTertiary }}>/{DUEL_SIZE}</Text>
      </Text>
    </View>
  );
}

function Pick({ who, right, text }: { who: string; right: boolean; text: string }) {
  const { colors } = useTheme();
  return (
    <Text style={[PlayType.body, styles.flex, { color: right ? colors.text : colors.textSecondary }]} numberOfLines={2}>
      <Text style={{ fontWeight: '900' }}>{who}: </Text>
      {text} {right ? '✓' : '✗'}
    </Text>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  steps: { flexDirection: 'row', gap: 6 },
  step: { flex: 1, height: 6, borderRadius: 3 },
  body: { padding: PLAY_GUTTER, paddingTop: 18 },
  gap: { gap: 14 },
  question: { gap: 16 },
  promptText: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', lineHeight: 31 },
  // Two columns: four answers sit in two rows, two answers side by side.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 16,
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tileText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  waitCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  headline: { fontSize: 26, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  board: { padding: 14, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowName: { flex: 1, fontSize: 16, fontWeight: '800' },
  rowScore: { fontSize: 22, fontWeight: '900' },
  answer: { padding: 14, gap: 6 },
  picks: { flexDirection: 'row', gap: 10, marginTop: 2 },
});
