import * as Haptics from '@/lib/haptics';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PLAY_TONES } from '@/components/activities/explore/explore-catalog';
import { AnswerShape } from '@/components/games/AnswerShape';
import { Confetti } from '@/components/games/Celebration';
import { PromptCard } from '@/components/games/room-panels';
import { ChunkyButton, firstName, shade } from '@/components/games/room-ui';
import { PlayHeader } from '@/components/play/PlayHeader';
import { PLAY_GUTTER, PlayPill, PlayType, playCardStyle } from '@/components/play/PlayKit';
import { Crown } from '@/components/ui/Crown';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useLightStatusBar } from '@/hooks/useLightStatusBar';
import { useTheme } from '@/hooks/useTheme';
import { DUEL_SIZE, answerDuel, duelId, duelOpen, ensureDuel, getDuel, type DuelSession } from '@/lib/game-room/duel';
import { todayKey } from '@/lib/play-progress';
import { BOOL_TILE_COLORS, QUIZ_TILE_COLORS } from '@/lib/quiz-live';
import { useAuthStore, useRelationshipStore } from '@/stores';

const tone = PLAY_TONES.amber;
const RIGHT = '#26890C';
const WRONG = '#E21B3C';

/**
 * The daily duel: the same three questions for you both. A "you vs them" header shows where each of
 * you is; you start when you're ready, answer three, and once you've both played the scores and
 * every answer show.
 */
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

  const [started, setStarted] = useState(false);
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

  const title = date === today ? 'Today’s duel' : 'Yesterday’s duel';
  const header = (
    <View style={{ backgroundColor: tone.accent }}>
      <PlayHeader title={title} onColor="#FFFFFF" />
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
  const result = state.result;
  const mineIn = !!state.answers[me.id];
  const theirsIn = !!state.answers[them.id];
  const open = duelOpen(state.date, today);
  const playing = !result && !mineIn && open && started;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        bounces={false}
        overScrollMode="never"
        stickyHeaderIndices={[0]}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}>
        {header}

        {/* You vs them: where each of you is, or the final score. */}
        <View style={[styles.hero, { backgroundColor: tone.accent }]}>
          <PlayPill label={date === today ? 'Daily duel · 3 questions' : 'Closes tonight'} />
          <View style={styles.vs}>
            <Player
              name="You"
              label={user?.name}
              avatar={user?.avatar_url}
              status={result ? null : mineIn ? 'Played' : playing ? 'Playing…' : 'Ready'}
              done={mineIn}
              score={result ? (result.scores[me.id] ?? 0) : null}
              crown={!!result && result.winnerId === me.id}
            />
            <View style={styles.vsMiddle}>
              {result ? (
                <Text style={styles.vsDash}>–</Text>
              ) : (
                <View style={styles.vsBadge}>
                  <Text style={styles.vsText}>VS</Text>
                </View>
              )}
            </View>
            <Player
              name={firstName(them.name)}
              label={partner?.name}
              avatar={partner?.avatar_url}
              status={result ? null : theirsIn ? 'Played' : 'Waiting…'}
              done={theirsIn}
              score={result ? (result.scores[them.id] ?? 0) : null}
              crown={!!result && result.winnerId === them.id}
            />
          </View>
          {playing ? (
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
        </View>

        <View style={styles.body}>
          {result ? (
            <DuelResults duel={duel} meId={me.id} themId={them.id} onDone={() => router.back()} />
          ) : mineIn ? (
            <Waiting name={firstName(them.name)} onDone={() => router.back()} />
          ) : !open ? (
            <EmptyState
              icon="time"
              title="This duel has closed"
              text="Duels stay open until the end of the next day. Today’s is waiting on Play."
            />
          ) : !started ? (
            <Intro theyPlayed={theirsIn} them={firstName(them.name)} onStart={() => setStarted(true)} />
          ) : saving || picks.length >= DUEL_SIZE ? (
            <View style={styles.centered}>
              <ActivityIndicator color={tone.accent} />
              <Text style={[PlayType.body, { color: colors.textSecondary }]}>Locking in your answers…</Text>
            </View>
          ) : (
            <Question duel={duel} index={picks.length} onPick={choose} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/** One side of the header: photo (crowned when they won), name, then their status or score. */
function Player({
  name,
  label,
  avatar,
  status,
  done,
  score,
  crown,
}: {
  name: string;
  label?: string | null;
  avatar?: string | null;
  status: string | null;
  done: boolean;
  score: number | null;
  crown: boolean;
}) {
  return (
    <View style={styles.player}>
      <View style={[styles.ring, { borderColor: crown ? '#FFD54A' : 'rgba(255,255,255,0.5)' }]}>
        <Avatar name={label ?? name} imageUrl={avatar ?? undefined} size={64} />
        {crown ? (
          <View style={styles.crown} pointerEvents="none">
            <Crown size={30} />
          </View>
        ) : null}
      </View>
      <Text style={styles.playerName} numberOfLines={1}>
        {name}
      </Text>
      {score !== null ? (
        <Text style={styles.score}>
          {score}
          <Text style={styles.scoreOf}>/{DUEL_SIZE}</Text>
        </Text>
      ) : status ? (
        <View style={[styles.status, done && styles.statusDone]}>
          {done ? <Icon name="check" size={13} color={tone.accent} /> : null}
          <Text style={[styles.statusText, done && { color: tone.accent }]}>{status}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Before you start: how it works, in three lines, and Start. */
function Intro({ theyPlayed, them, onStart }: { theyPlayed: boolean; them: string; onStart: () => void }) {
  const { colors } = useTheme();
  const rows: { icon: IconName; text: string }[] = [
    { icon: 'bulb', text: 'The same three questions for you both' },
    { icon: 'star', text: 'One point for each right answer' },
    { icon: 'lock', text: 'Answers stay hidden until you’ve both played' },
  ];
  return (
    <Animated.View entering={FadeIn.duration(160)} style={styles.gap}>
      {theyPlayed ? (
        <View style={[styles.nudgeLine, { backgroundColor: tone.soft }]}>
          <Icon name="time" size={16} color={tone.accent} />
          <Text style={[styles.nudgeText, { color: tone.accent }]}>{them} has played. Your turn!</Text>
        </View>
      ) : null}
      <View style={[styles.howCard, playCardStyle(colors)]}>
        {rows.map((r) => (
          <View key={r.text} style={styles.howRow}>
            <View style={[styles.howIcon, { backgroundColor: tone.soft }]}>
              <Icon name={r.icon} size={18} color={tone.accent} filled />
            </View>
            <Text style={[PlayType.body, styles.flex, { color: colors.text }]}>{r.text}</Text>
          </View>
        ))}
      </View>
      <ChunkyButton label="Start the duel" color={tone.accent} onPress={onStart} />
    </Animated.View>
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

/** You've played; they haven't. */
function Waiting({ name, onDone }: { name: string; onDone: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.gap}>
      <View style={[styles.waitCard, playCardStyle(colors)]}>
        <View style={[styles.howIcon, { backgroundColor: tone.soft }]}>
          <Icon name="lock" size={18} color={tone.accent} filled />
        </View>
        <View style={styles.flex}>
          <Text style={[PlayType.title, { color: colors.text }]}>Locked in</Text>
          <Text style={[PlayType.body, { color: colors.textSecondary }]}>
            We’ve let {name} know it’s their turn. The scores and answers show as soon as they play.
          </Text>
        </View>
      </View>
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
  const router = useRouter();
  const { colors } = useTheme();
  const partner = useRelationshipStore((s) => s.partner);
  const state = duel.state;
  const result = state.result!;
  const them = firstName(partner?.name);
  const headline = result.winnerId === meId ? 'You win today!' : result.winnerId ? `${them} wins today` : 'A tie today';

  return (
    <View style={styles.gap}>
      {result.winnerId === meId ? <Confetti burstKey={duel.version} /> : null}
      <Text style={[styles.headline, { color: colors.text }]}>{headline}</Text>

      {state.questions.map((q, i) => {
        const a = state.answers[meId]?.[i];
        const b = state.answers[themId]?.[i];
        return (
          <View key={i} style={[styles.answer, playCardStyle(colors)]}>
            <Text style={[styles.qLabel, { color: colors.textTertiary }]}>QUESTION {i + 1}</Text>
            <Text style={[PlayType.title, { color: colors.text }]}>{q.question}</Text>
            <View style={[styles.correct, { backgroundColor: `${RIGHT}1A` }]}>
              <Icon name="check" size={14} color={RIGHT} />
              <Text style={[styles.correctText, { color: RIGHT }]} numberOfLines={2}>
                {q.options[q.correctIndex]}
              </Text>
            </View>
            <PickLine who="You" right={a === q.correctIndex} text={a !== undefined ? q.options[a] : 'No answer'} />
            <PickLine who={them} right={b === q.correctIndex} text={b !== undefined ? q.options[b] : 'No answer'} />
          </View>
        );
      })}

      <Pressable onPress={() => router.push('/play/progress')} accessibilityRole="button" style={styles.h2hLink}>
        <Text style={[styles.h2hText, { color: tone.accent }]}>See your head to head</Text>
        <Icon name="chevronRight" size={16} color={tone.accent} />
      </Pressable>
      <Text style={[PlayType.body, styles.center, { color: colors.textSecondary }]}>New questions tomorrow.</Text>
      <ChunkyButton label="Done" color={tone.accent} onPress={onDone} />
    </View>
  );
}

/** "You: Paris ✓" with a round tick or cross. */
function PickLine({ who, right, text }: { who: string; right: boolean; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.pickLine}>
      <View style={[styles.mark, { backgroundColor: right ? RIGHT : WRONG }]}>
        <Icon name={right ? 'check' : 'close'} size={12} color="#FFFFFF" />
      </View>
      <Text style={[PlayType.body, styles.flex, { color: colors.text }]} numberOfLines={2}>
        <Text style={styles.bold}>{who}: </Text>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  bold: { fontWeight: '900' },
  center: { textAlign: 'center' },
  centered: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, gap: 12 },
  hero: {
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 6,
    paddingBottom: 24,
    gap: 16,
    alignItems: 'center',
  },
  vs: { flexDirection: 'row', alignItems: 'flex-start', alignSelf: 'stretch' },
  vsMiddle: { width: 56, height: 72, alignItems: 'center', justifyContent: 'center' },
  vsBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  vsText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
  vsDash: { color: 'rgba(255,255,255,0.8)', fontSize: 34, fontWeight: '900' },
  player: { flex: 1, alignItems: 'center', gap: 6 },
  ring: { borderWidth: 3, borderRadius: 999, padding: 2 },
  crown: { position: 'absolute', top: -19, left: 0, right: 0, alignItems: 'center' },
  playerName: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', maxWidth: 120 },
  score: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', letterSpacing: -0.5 },
  scoreOf: { fontSize: 16, color: 'rgba(255,255,255,0.75)' },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  statusDone: { backgroundColor: '#FFFFFF' },
  statusText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  steps: { flexDirection: 'row', gap: 6, alignSelf: 'stretch' },
  step: { flex: 1, height: 6, borderRadius: 3 },
  body: { padding: PLAY_GUTTER, paddingTop: 18 },
  gap: { gap: 14 },
  nudgeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  nudgeText: { fontSize: 14, fontWeight: '800' },
  howCard: { padding: 16, gap: 14 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  howIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
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
  waitCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 16 },
  headline: { fontSize: 26, fontWeight: '900', textAlign: 'center', marginTop: 4 },
  answer: { padding: 14, gap: 8 },
  qLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 1 },
  correct: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  correctText: { fontSize: 14, fontWeight: '800', flexShrink: 1 },
  pickLine: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  mark: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  h2hLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 6 },
  h2hText: { fontSize: 15, fontWeight: '800' },
});
