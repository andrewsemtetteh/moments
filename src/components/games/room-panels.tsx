import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import type { PlayTone } from '@/components/activities/explore/explore-catalog';
import { Avatar } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { gameRoom } from '@/lib/game-room/manager';
import { QUIZ_ANSWER_MS, type ChoiceItem, type PromptItem, type QuizItem, type RoomState } from '@/lib/game-room/types';
import { BOOL_TILE_COLORS, QUIZ_TILE_COLORS } from '@/lib/quiz-live';
import { useGameRoomStore } from '@/stores/game-room-store';

import { ChunkyButton, RoundEnter, firstName, shade, useRoomPlayers } from './room-ui';

interface PanelProps {
  state: RoomState;
  tone: PlayTone;
}

const CHOICE_COLORS = ['#FF6B8A', '#5B8DEF'] as const;

function useMe(state: RoomState) {
  const { meId, me, partner } = useRoomPlayers();
  const other = state.players.find((p) => p.id !== meId);
  return {
    meId,
    me,
    partner,
    partnerId: other?.id ?? partner.id,
    myAnswer: state.answers[meId],
    partnerAnswered: other ? state.answers[other.id] !== undefined : false,
    isMyTurn: state.turnId === meId,
    turnName: state.turnId === meId ? 'You' : firstName(partner.name),
  };
}

function Waiting({ text }: { text: string }) {
  const { colors } = useTheme();
  const t = useSharedValue(0.4);
  useEffect(() => {
    t.value = withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0.4, { duration: 700 })), -1);
  }, [t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value }));
  return (
    <Animated.View style={[styles.waiting, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }, style]}>
      <Text style={[styles.waitingText, { color: colors.textSecondary }]}>{text}</Text>
    </Animated.View>
  );
}

function PromptCard({ tone, eyebrow, children }: { tone: PlayTone; eyebrow?: string; children: ReactNode }) {
  return (
    <LinearGradient
      colors={[tone.accent, shade(tone.accent, -0.28)]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.promptCard}>
      {eyebrow ? <Text style={styles.promptEyebrow}>{eyebrow}</Text> : null}
      {children}
    </LinearGradient>
  );
}

function RevealFooter({ state, tone }: PanelProps) {
  const { colors } = useTheme();
  const last = state.round + 1 >= state.totalRounds;
  return (
    <RoundEnter delay={150}>
      <View style={styles.footer}>
        {state.message ? <Text style={[styles.message, { color: colors.text }]}>{state.message}</Text> : null}
        <ChunkyButton
          label={last ? 'See results' : 'Next round'}
          color={tone.accent}
          onPress={() => gameRoom.dispatch({ t: 'next' })}
        />
      </View>
    </RoundEnter>
  );
}

function Picker({ name, avatar }: { name: string; avatar: string | null }) {
  const { colors } = useTheme();
  return (
    <View style={styles.picker}>
      <Avatar name={name} imageUrl={avatar} size={26} />
      <Text style={[styles.pickerName, { color: colors.text }]} numberOfLines={1}>
        {firstName(name)}
      </Text>
    </View>
  );
}

function AnswerInput({
  value,
  onChange,
  placeholder,
  maxLength = 140,
  multiline = true,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  maxLength?: number;
  multiline?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={colors.textTertiary}
      maxLength={maxLength}
      multiline={multiline}
      style={[
        styles.input,
        { color: colors.text, backgroundColor: colors.surfaceElevated, borderColor: colors.border },
      ]}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Would You Rather / This or That                                            */
/* -------------------------------------------------------------------------- */

export function ChoicePanel({ state, tone }: PanelProps) {
  const { colors } = useTheme();
  const { meId, me, partner, partnerId, myAnswer, partnerAnswered } = useMe(state);
  const item = state.items[state.round] as ChoiceItem | undefined;
  if (!item) return null;
  const revealed = state.step === 'reveal';
  const options = [
    { key: 'a', text: item.a },
    { key: 'b', text: item.b },
  ];
  const isThisOrThat = state.game === 'thisOrThat';

  return (
    <View style={styles.panel}>
      <RoundEnter>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          {isThisOrThat ? 'Quick — pick one!' : 'Would you rather…'}
        </Text>
      </RoundEnter>
      <View style={[styles.choiceStack, isThisOrThat && styles.choiceRow]}>
        {options.map((opt, i) => {
          const color = CHOICE_COLORS[i];
          const mine = myAnswer === opt.key;
          const theirs = state.answers[partnerId] === opt.key;
          const dim = revealed ? false : myAnswer !== undefined && !mine;
          const matched = revealed && state.answers[meId] === state.answers[partnerId];
          return (
            <RoundEnter key={opt.key} delay={i * 90}>
              <Pressable
                disabled={myAnswer !== undefined || revealed}
                onPress={() => gameRoom.dispatch({ t: 'answer', value: opt.key })}
                accessibilityRole="button"
                accessibilityLabel={opt.text}
                style={({ pressed }) => [
                  styles.choice,
                  isThisOrThat && styles.choiceHalf,
                  {
                    backgroundColor: color,
                    borderBottomColor: shade(color, -0.3),
                    borderBottomWidth: pressed ? 1 : 6,
                    marginTop: pressed ? 5 : 0,
                    opacity: dim ? 0.45 : 1,
                    borderColor: matched ? '#FFD54A' : 'transparent',
                    borderWidth: matched ? 3 : 0,
                  },
                ]}>
                <Text style={[styles.choiceLetter]}>{opt.key.toUpperCase()}</Text>
                <Text style={[styles.choiceText, isThisOrThat && { fontSize: 22, textAlign: 'center' }]}>{opt.text}</Text>
                {mine && !revealed ? <Text style={styles.lockedTag}>Your pick ✓</Text> : null}
                {revealed ? (
                  <View style={styles.pickers}>
                    {mine ? <Picker name={me.name} avatar={me.avatar} /> : null}
                    {theirs ? <Picker name={partner.name} avatar={partner.avatar} /> : null}
                  </View>
                ) : null}
              </Pressable>
            </RoundEnter>
          );
        })}
      </View>
      {!revealed && myAnswer !== undefined && !partnerAnswered ? (
        <Waiting text={`Waiting for ${firstName(partner.name)}…`} />
      ) : null}
      {!revealed && myAnswer === undefined && partnerAnswered ? (
        <Text style={[styles.hint, { color: tone.accent }]}>{firstName(partner.name)} already picked 👀</Text>
      ) : null}
      {revealed ? <RevealFooter state={state} tone={tone} /> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Who's More Likely                                                          */
/* -------------------------------------------------------------------------- */

export function LikelyPanel({ state, tone }: PanelProps) {
  const { colors } = useTheme();
  const { meId, me, partner, partnerId, myAnswer, partnerAnswered } = useMe(state);
  const item = state.items[state.round] as PromptItem | undefined;
  if (!item) return null;
  const revealed = state.step === 'reveal';
  const nameFor = (id: string | undefined) =>
    id === meId ? 'themselves' : id === partnerId ? firstName(partner.name) : '—';
  const targets = [
    { id: meId, label: 'Me', avatar: me.avatar, name: me.name },
    { id: partnerId, label: firstName(partner.name), avatar: partner.avatar, name: partner.name },
  ];

  return (
    <View style={styles.panel}>
      <RoundEnter>
        <PromptCard tone={tone} eyebrow="POINT AT ONE OF YOU">
          <Text style={styles.promptText}>{item.text}</Text>
        </PromptCard>
      </RoundEnter>

      <View style={styles.pointRow}>
        {targets.map((t, i) => {
          const chosen = myAnswer === t.id;
          const theirsChose = state.answers[partnerId] === t.id;
          return (
            <RoundEnter key={t.id} delay={120 + i * 80}>
              <Pressable
                disabled={myAnswer !== undefined || revealed}
                onPress={() => gameRoom.dispatch({ t: 'answer', value: t.id })}
                accessibilityRole="button"
                accessibilityLabel={`Point at ${t.label}`}
                style={({ pressed }) => [
                  styles.pointBtn,
                  {
                    backgroundColor: chosen ? tone.accent : colors.surfaceElevated,
                    borderColor: chosen ? shade(tone.accent, -0.3) : colors.border,
                    borderBottomWidth: pressed ? 1 : 5,
                    opacity: myAnswer !== undefined && !chosen && !revealed ? 0.5 : 1,
                  },
                ]}>
                <Avatar name={t.name} imageUrl={t.avatar} size={64} />
                <Text style={[styles.pointLabel, { color: chosen ? '#fff' : colors.text }]}>{t.label}</Text>
                {revealed && theirsChose ? <Text style={styles.pointTag}>👉 {firstName(partner.name)}</Text> : null}
              </Pressable>
            </RoundEnter>
          );
        })}
      </View>

      {!revealed && myAnswer !== undefined && !partnerAnswered ? (
        <Waiting text={`Waiting for ${firstName(partner.name)}…`} />
      ) : null}
      {revealed ? (
        <RoundEnter>
          <View style={[styles.revealBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.revealLine, { color: colors.text }]}>
              You picked <Text style={{ fontWeight: '900' }}>{nameFor(state.answers[meId])}</Text>
            </Text>
            <Text style={[styles.revealLine, { color: colors.text }]}>
              {firstName(partner.name)} picked <Text style={{ fontWeight: '900' }}>{nameFor(state.answers[partnerId])}</Text>
            </Text>
          </View>
        </RoundEnter>
      ) : null}
      {revealed ? <RevealFooter state={state} tone={tone} /> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Truth or Dare                                                              */
/* -------------------------------------------------------------------------- */

export function TruthDarePanel({ state, tone }: PanelProps) {
  const { colors } = useTheme();
  const { partner, isMyTurn, turnName } = useMe(state);
  const turnLabel = isMyTurn ? 'Your turn' : `${firstName(partner.name)}’s turn`;
  const cur = state.current;

  return (
    <View style={styles.panel}>
      <RoundEnter>
        <View style={[styles.turnBanner, { backgroundColor: tone.soft }]}>
          <Text style={[styles.turnText, { color: tone.accent }]}>{turnLabel}</Text>
        </View>
      </RoundEnter>

      {state.step === 'choose' ? (
        isMyTurn ? (
          <View style={styles.tdChoose}>
            <ChunkyButton label="🤫  Truth" color="#5B8DEF" onPress={() => gameRoom.dispatch({ t: 'pickKind', kind: 'truth' })} />
            <ChunkyButton label="🔥  Dare" color="#FF5A5F" onPress={() => gameRoom.dispatch({ t: 'pickKind', kind: 'dare' })} />
          </View>
        ) : (
          <Waiting text={`${turnName} is choosing truth or dare…`} />
        )
      ) : null}

      {cur && state.step !== 'choose' ? (
        <RoundEnter>
          <PromptCard tone={{ ...tone, accent: cur.kind === 'truth' ? '#5B8DEF' : '#FF5A5F' }} eyebrow={cur.kind === 'truth' ? '🤫 TRUTH' : '🔥 DARE'}>
            <Text style={styles.promptText}>{cur.text}</Text>
          </PromptCard>
        </RoundEnter>
      ) : null}

      {state.step === 'perform' ? (
        isMyTurn ? (
          <View style={styles.tdChoose}>
            <ChunkyButton label="✅  Done!" color="#3DBE7A" onPress={() => gameRoom.dispatch({ t: 'perform', done: true })} />
            <ChunkyButton label="Skip" compact color={colors.textTertiary} onPress={() => gameRoom.dispatch({ t: 'perform', done: false })} />
          </View>
        ) : (
          <Waiting text={`${turnName} is on it — listen up! 🎧`} />
        )
      ) : null}

      {state.step === 'rate' ? (
        !isMyTurn ? (
          <View style={styles.tdChoose}>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>How did they do?</Text>
            <View style={styles.rateRow}>
              <ChunkyButton label="👍  Loved it" style={{ flex: 1 }} color="#3DBE7A" onPress={() => gameRoom.dispatch({ t: 'rate', up: true })} />
              <ChunkyButton label="👎  Meh" style={{ flex: 1 }} color="#8A8F98" onPress={() => gameRoom.dispatch({ t: 'rate', up: false })} />
            </View>
          </View>
        ) : (
          <Waiting text={`${firstName(partner.name)} is judging you…`} />
        )
      ) : null}

      {state.step === 'reveal' ? <RevealFooter state={state} tone={tone} /> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Guess My Answer                                                            */
/* -------------------------------------------------------------------------- */

export function GuessPanel({ state, tone }: PanelProps) {
  const { colors } = useTheme();
  const { partner, meId, isMyTurn, turnName } = useMe(state);
  const [text, setText] = useState('');
  const item = state.items[state.round] as PromptItem | undefined;

  useEffect(() => setText(''), [state.round, state.step]);
  if (!item) return null;

  const guesserId = state.players.find((p) => p.id !== state.turnId)?.id ?? '';
  const guess = state.answers[guesserId];
  const subjectName = isMyTurn ? 'your' : `${firstName(partner.name)}’s`;

  return (
    <View style={styles.panel}>
      <RoundEnter>
        <PromptCard tone={tone} eyebrow={isMyTurn ? 'ANSWER SECRETLY' : `GUESS ${subjectName.toUpperCase()} ANSWER`}>
          <Text style={styles.promptText}>{item.text}</Text>
        </PromptCard>
      </RoundEnter>

      {state.step === 'write' ? (
        isMyTurn ? (
          <View style={styles.formStack}>
            <AnswerInput value={text} onChange={setText} placeholder="Type your real answer…" />
            <ChunkyButton
              label="Lock it in 🔒"
              color={tone.accent}
              disabled={!text.trim()}
              onPress={() => gameRoom.dispatch({ t: 'write', text })}
            />
          </View>
        ) : (
          <Waiting text={`${turnName} is answering in secret…`} />
        )
      ) : null}

      {state.step === 'guess' ? (
        !isMyTurn ? (
          <View style={styles.formStack}>
            <AnswerInput value={text} onChange={setText} placeholder="What do you think they said?" />
            <ChunkyButton
              label="Submit guess"
              color={tone.accent}
              disabled={!text.trim()}
              onPress={() => gameRoom.dispatch({ t: 'guess', value: text })}
            />
          </View>
        ) : (
          <Waiting text={`${firstName(partner.name)} is guessing…`} />
        )
      ) : null}

      {state.step === 'judge' || state.step === 'reveal' ? (
        <RoundEnter>
          <View style={[styles.revealBox, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            {isMyTurn || state.step === 'reveal' ? (
              <Text style={[styles.revealLine, { color: colors.text }]}>
                {isMyTurn ? 'You' : firstName(partner.name)} said: <Text style={{ fontWeight: '900' }}>{state.secret?.text}</Text>
              </Text>
            ) : null}
            <Text style={[styles.revealLine, { color: colors.text }]}>
              {guesserId === meId ? 'You' : firstName(partner.name)} guessed: <Text style={{ fontWeight: '900' }}>{guess}</Text>
            </Text>
          </View>
        </RoundEnter>
      ) : null}

      {state.step === 'judge' ? (
        isMyTurn ? (
          <View style={styles.tdChoose}>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Was that right?</Text>
            <ChunkyButton label="✅  Nailed it" color="#3DBE7A" onPress={() => gameRoom.dispatch({ t: 'judge', verdict: 'yes' })} />
            <View style={styles.rateRow}>
              <ChunkyButton label="🤏  Close" compact style={{ flex: 1 }} color="#E5A83A" onPress={() => gameRoom.dispatch({ t: 'judge', verdict: 'close' })} />
              <ChunkyButton label="❌  Nope" compact style={{ flex: 1 }} color="#FF5A5F" onPress={() => gameRoom.dispatch({ t: 'judge', verdict: 'no' })} />
            </View>
          </View>
        ) : (
          <Waiting text={`${firstName(partner.name)} is judging your guess…`} />
        )
      ) : null}

      {state.step === 'reveal' ? <RevealFooter state={state} tone={tone} /> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Two Truths & a Lie                                                         */
/* -------------------------------------------------------------------------- */

export function TwoTruthsPanel({ state, tone }: PanelProps) {
  const { colors } = useTheme();
  const { partner, isMyTurn, turnName } = useMe(state);
  const [lines, setLines] = useState(['', '', '']);
  const [lie, setLie] = useState<number | null>(null);

  useEffect(() => {
    setLines(['', '', '']);
    setLie(null);
  }, [state.round]);

  const statements = state.secret?.statements ?? [];
  const guessedRaw = Object.values(state.answers)[0];
  const guessed = guessedRaw !== undefined ? Number(guessedRaw) : null;
  const revealed = state.step === 'reveal';

  return (
    <View style={styles.panel}>
      <RoundEnter>
        <View style={[styles.turnBanner, { backgroundColor: tone.soft }]}>
          <Text style={[styles.turnText, { color: tone.accent }]}>
            {isMyTurn ? 'Fool your partner' : `${firstName(partner.name)} is up`}
          </Text>
        </View>
      </RoundEnter>

      {state.step === 'write' ? (
        isMyTurn ? (
          <View style={styles.formStack}>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Write 3 statements about you and tap the one that’s a lie.
            </Text>
            {lines.map((line, i) => (
              <View key={i} style={styles.lineRow}>
                <Pressable
                  onPress={() => setLie(i)}
                  accessibilityRole="radio"
                  accessibilityLabel={`Statement ${i + 1} is the lie`}
                  accessibilityState={{ selected: lie === i }}
                  style={[
                    styles.lieToggle,
                    { borderColor: lie === i ? '#FF5A5F' : colors.border, backgroundColor: lie === i ? '#FF5A5F' : 'transparent' },
                  ]}>
                  <Text style={{ color: lie === i ? '#fff' : colors.textTertiary, fontWeight: '900', fontSize: 11 }}>LIE</Text>
                </Pressable>
                <View style={{ flex: 1 }}>
                  <AnswerInput
                    value={line}
                    onChange={(v) => setLines((prev) => prev.map((p, idx) => (idx === i ? v : p)))}
                    placeholder={i === 0 ? 'e.g. I once met a celebrity…' : `Statement ${i + 1}`}
                    multiline={false}
                  />
                </View>
              </View>
            ))}
            <ChunkyButton
              label="Lock it in 🔒"
              color={tone.accent}
              disabled={lie === null || lines.some((l) => !l.trim())}
              onPress={() => gameRoom.dispatch({ t: 'write', statements: lines, lie: lie ?? 0 })}
            />
          </View>
        ) : (
          <Waiting text={`${turnName} is writing their statements…`} />
        )
      ) : null}

      {state.step === 'guess' || revealed ? (
        <View style={styles.formStack}>
          {!isMyTurn && state.step === 'guess' ? (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>Which one is the lie?</Text>
          ) : null}
          {statements.map((s, i) => {
            const isLie = state.secret?.lie === i;
            const bg = revealed ? (isLie ? '#FF5A5F' : '#3DBE7A') : colors.surfaceElevated;
            return (
              <RoundEnter key={i} delay={i * 80}>
                <Pressable
                  disabled={isMyTurn || revealed}
                  onPress={() => gameRoom.dispatch({ t: 'guess', value: String(i) })}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.statement,
                    {
                      backgroundColor: bg,
                      borderColor: revealed ? shade(bg, -0.25) : colors.border,
                      borderBottomWidth: pressed ? 1 : 4,
                    },
                  ]}>
                  <Text style={[styles.statementText, { color: revealed ? '#fff' : colors.text }]}>{s}</Text>
                  {revealed ? (
                    <Text style={styles.statementTag}>
                      {isLie ? '🤥 THE LIE' : '✓ truth'}
                      {guessed === i ? '  · guessed' : ''}
                    </Text>
                  ) : null}
                </Pressable>
              </RoundEnter>
            );
          })}
          {isMyTurn && state.step === 'guess' ? (
            <Waiting text={`${firstName(partner.name)} is studying your poker face…`} />
          ) : null}
        </View>
      ) : null}

      {revealed ? <RevealFooter state={state} tone={tone} /> : null}
    </View>
  );
}

/* -------------------------------------------------------------------------- */
/* Quiz Showdown                                                              */
/* -------------------------------------------------------------------------- */

function useCountdown(deadline: number | null) {
  const skew = useGameRoomStore((s) => s.clockSkew);
  const [remaining, setRemaining] = useState(QUIZ_ANSWER_MS);
  useEffect(() => {
    if (!deadline) return;
    const tick = () => setRemaining(Math.max(0, deadline + skew - Date.now()));
    tick();
    const id = setInterval(tick, 150);
    return () => clearInterval(id);
  }, [deadline, skew]);
  return remaining;
}

export function QuizPanel({ state, tone }: PanelProps) {
  const { colors } = useTheme();
  const { meId, me, partner, partnerId, myAnswer } = useMe(state);
  const item = state.items[state.round] as QuizItem | undefined;
  const remaining = useCountdown(state.step === 'answer' ? state.deadline : null);
  if (!item) return null;
  const revealed = state.step === 'reveal';
  const palette = item.options.length === 2 ? BOOL_TILE_COLORS : QUIZ_TILE_COLORS;
  const pct = state.step === 'answer' ? remaining / QUIZ_ANSWER_MS : 0;
  const seconds = Math.ceil(remaining / 1000);
  const hot = pct < 0.35;

  return (
    <View style={styles.panel}>
      {state.step === 'answer' ? (
        <View style={[styles.timerTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.timerFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: hot ? '#FF5A5F' : tone.accent }]} />
          <Text style={[styles.timerText, { color: colors.text }]}>{seconds}s</Text>
        </View>
      ) : null}

      <RoundEnter>
        <PromptCard tone={tone} eyebrow={item.correctIndex === undefined ? 'MATCH YOUR PARTNER' : 'QUESTION'}>
          <Text style={styles.promptText}>{item.question}</Text>
        </PromptCard>
      </RoundEnter>

      <View style={styles.quizGrid}>
        {item.options.map((opt, i) => {
          const color = palette[i % palette.length];
          const mine = myAnswer === String(i);
          const theirs = state.answers[partnerId] === String(i);
          const isCorrect = item.correctIndex === i;
          const faded = revealed ? item.correctIndex !== undefined && !isCorrect : myAnswer !== undefined && !mine;
          return (
            <RoundEnter key={i} delay={i * 60}>
              <Pressable
                disabled={myAnswer !== undefined || revealed}
                onPress={() => gameRoom.dispatch({ t: 'answer', value: String(i) })}
                accessibilityRole="button"
                accessibilityLabel={opt}
                style={({ pressed }) => [
                  styles.quizTile,
                  {
                    backgroundColor: color,
                    borderBottomColor: shade(color, -0.3),
                    borderBottomWidth: pressed ? 1 : 5,
                    opacity: faded ? 0.35 : 1,
                    borderColor: revealed && isCorrect ? '#FFD54A' : 'transparent',
                    borderWidth: revealed && isCorrect ? 3 : 0,
                  },
                ]}>
                <Text style={styles.quizTileText}>{opt}</Text>
                {revealed ? (
                  <View style={styles.pickers}>
                    {mine ? <Picker name={me.name} avatar={me.avatar} /> : null}
                    {theirs ? <Picker name={partner.name} avatar={partner.avatar} /> : null}
                  </View>
                ) : mine ? (
                  <Text style={styles.lockedTag}>Locked ✓</Text>
                ) : null}
              </Pressable>
            </RoundEnter>
          );
        })}
      </View>

      {!revealed && myAnswer !== undefined && state.answers[partnerId] === undefined ? (
        <Waiting text={`Waiting for ${firstName(partner.name)}…`} />
      ) : null}
      {revealed && state.answers[meId] === '-1' ? (
        <Text style={[styles.hint, { color: '#FF5A5F' }]}>Time’s up ⏰</Text>
      ) : null}
      {revealed ? <RevealFooter state={state} tone={tone} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: 16 },
  hint: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  waiting: {
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  waitingText: { fontSize: 14, fontWeight: '700' },
  promptCard: { borderRadius: 26, padding: 22, gap: 10, minHeight: 130, justifyContent: 'center' },
  promptEyebrow: { color: 'rgba(255,255,255,0.8)', fontSize: 11, fontWeight: '900', letterSpacing: 1.2 },
  promptText: { color: '#fff', fontSize: 24, fontWeight: '800', lineHeight: 31 },
  footer: { gap: 12 },
  message: { fontSize: 20, fontWeight: '900', textAlign: 'center' },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingRight: 10,
    paddingLeft: 3,
    paddingVertical: 3,
  },
  pickerName: { color: '#fff', fontSize: 12, fontWeight: '800', maxWidth: 70 },
  pickers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  choiceStack: { gap: 14 },
  choiceRow: { flexDirection: 'row', gap: 12 },
  choice: { borderRadius: 24, padding: 22, minHeight: 116, justifyContent: 'center', gap: 6 },
  choiceHalf: { flex: 1, minHeight: 170, alignItems: 'center' },
  choiceLetter: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '900', letterSpacing: 1.5 },
  choiceText: { color: '#fff', fontSize: 20, fontWeight: '800', lineHeight: 26 },
  lockedTag: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '800', marginTop: 4 },
  pointRow: { flexDirection: 'row', gap: 12 },
  pointBtn: {
    flex: 1,
    borderRadius: 24,
    borderWidth: 2,
    paddingVertical: 20,
    alignItems: 'center',
    gap: 10,
  },
  pointLabel: { fontSize: 18, fontWeight: '900' },
  pointTag: { fontSize: 12, fontWeight: '800', color: '#FFD54A' },
  revealBox: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6 },
  revealLine: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  turnBanner: { alignSelf: 'center', borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 },
  turnText: { fontSize: 14, fontWeight: '900', letterSpacing: 0.6 },
  tdChoose: { gap: 12 },
  rateRow: { flexDirection: 'row', gap: 12 },
  formStack: { gap: 12 },
  input: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    fontWeight: '600',
    minHeight: 56,
    textAlignVertical: 'top',
  },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  lieToggle: {
    width: 46,
    height: 46,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statement: { borderRadius: 20, borderWidth: 2, padding: 18, gap: 4 },
  statementText: { fontSize: 18, fontWeight: '700', lineHeight: 24 },
  statementTag: { color: 'rgba(255,255,255,0.9)', fontSize: 12, fontWeight: '900' },
  timerTrack: { height: 26, borderRadius: 13, overflow: 'hidden', justifyContent: 'center' },
  timerFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 13 },
  timerText: { textAlign: 'center', fontSize: 13, fontWeight: '900' },
  quizGrid: { gap: 12 },
  quizTile: { borderRadius: 20, paddingVertical: 20, paddingHorizontal: 18, minHeight: 68, justifyContent: 'center' },
  quizTileText: { color: '#fff', fontSize: 18, fontWeight: '800' },
});

