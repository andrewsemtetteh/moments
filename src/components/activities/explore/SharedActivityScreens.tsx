import { differenceInCalendarDays, format, parseISO, subDays } from 'date-fns';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput } from '@/components/ui/ThemedTextInput';

import { Icon } from '@/components/ui/Icon';
import { NudgeButton } from '@/components/ui/NudgeButton';
import { Avatar, PrimaryButton, colorWithAlpha } from '@/components/ui/primitives';
import { WEEK_CHALLENGE } from '@/constants/activity-content';
import { useSharedActivities } from '@/hooks/useSharedActivity';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { localCalendarDate, spaceCalendarDate } from '@/lib/db-time';
import * as Haptics from '@/lib/haptics';
import { openChat } from '@/lib/router';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { Activity, UserProfile } from '@/types/database';

// ── Gratitude swap ─────────────────────────────────────────────────────────
// Like today's question: each of you writes three things you appreciated about the
// other; yours stays hidden from them (and theirs from you) until you've both swapped.

type GratitudePayload = { date: string; answers: Record<string, string[]> };

function gratitudeOf(row: Activity | undefined): GratitudePayload | null {
  if (!row) return null;
  const p = row.payload as Partial<GratitudePayload>;
  return { date: String(p.date ?? ''), answers: (p.answers as Record<string, string[]>) ?? {} };
}

export function GratitudeSwapScreen() {
  const { colors } = useTheme();
  const me = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const partnerName = getFirstName(partner?.name) ?? 'your partner';
  const { rows, relationshipId, refresh, isLoading } = useSharedActivities('gratitude_swap');
  const [items, setItems] = useState(['', '', '']);
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const today = localCalendarDate(now);
  const yesterday = localCalendarDate(subDays(now, 1));
  const evening = now.getHours() >= 18;
  const byDate = (d: string) => rows.find((r) => gratitudeOf(r)?.date === d);

  // Yesterday's swap that you never wrote yours for comes first (like an unanswered question).
  const yRow = byDate(yesterday);
  const yData = gratitudeOf(yRow);
  const catchUp = !!yData && !!me && !yData.answers[me.id] && !!partner && !!yData.answers[partner.id];
  const activeDate = catchUp ? yesterday : today;
  const active = gratitudeOf(byDate(activeDate));
  const mine = me ? active?.answers[me.id] : undefined;
  const theirs = partner ? active?.answers[partner.id] : undefined;

  const title = catchUp ? 'Yesterday’s gratitude' : evening ? 'Tonight’s gratitude' : 'Today’s gratitude';
  const history = rows
    .map((r) => gratitudeOf(r)!)
    .filter((g) => g.date !== activeDate && me && partner && g.answers[me.id] && g.answers[partner.id])
    .slice(0, 5);

  const submit = async () => {
    if (!relationshipId || !me) return;
    const filled = items.map((t) => t.trim()).filter(Boolean);
    if (filled.length === 0) {
      Alert.alert('Add at least one', `Write something you appreciated about ${partnerName}.`);
      return;
    }
    setSaving(true);
    try {
      // Read the latest first so we never overwrite what they just sent.
      const latest = await api.fetchActivitiesOfType(relationshipId, 'gratitude_swap');
      const row = latest.find((r) => gratitudeOf(r)?.date === activeDate);
      const answers = { ...(gratitudeOf(row)?.answers ?? {}), [me.id]: filled };
      const both = !!partner && !!answers[partner.id];
      if (row) {
        await api.updateActivity(row.id, { payload: { date: activeDate, answers }, status: both ? 'completed' : 'in_progress' });
      } else {
        await api.createActivity(relationshipId, 'gratitude_swap', { date: activeDate, answers });
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setItems(['', '', '']);
      if (partner) {
        const myName = getFirstName(me.name) ?? 'Your partner';
        void api
          .sendPartnerNotification(
            relationshipId,
            partner.id,
            'gratitude',
            both ? `${myName} swapped gratitude with you. See what they wrote 💛` : `${myName} wrote what they’re grateful for. Write yours to swap.`,
          )
          .catch(() => undefined);
      }
      void refresh();
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <View style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Text style={[styles.kicker, { color: colors.accent }]}>{title.toUpperCase()}</Text>
        <Text style={[styles.prompt, { color: colors.text }]}>
          What did {partnerName} do {catchUp ? 'yesterday' : 'today'} that you appreciated?
        </Text>
        <Who me={me} partner={partner} mineDone={!!mine} theirsDone={!!theirs} />

        {!mine ? (
          <>
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              {theirs
                ? `${partnerName} already wrote theirs. Write yours to see them.`
                : `You’ll see ${partnerName}’s once you’ve both swapped.`}
            </Text>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.num, { color: colors.accent }]}>{i + 1}</Text>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder={i === 0 ? 'Something small…' : i === 1 ? 'Something sweet…' : 'Something meaningful…'}
                  placeholderTextColor={colors.textTertiary}
                  value={items[i]}
                  onChangeText={(v) => setItems((prev) => prev.map((x, j) => (j === i ? v : x)))}
                  multiline
                />
              </View>
            ))}
            <PrimaryButton label={saving ? 'Swapping…' : 'Swap'} onPress={() => void submit()} loading={saving} />
          </>
        ) : !theirs ? (
          <>
            <GratitudeList label="Yours" items={mine} />
            <View style={[styles.waiting, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <View style={styles.waitingLines}>
                <Text style={[styles.waitingTitle, { color: colors.text }]} numberOfLines={1}>
                  Waiting for {partnerName}
                </Text>
                <Text style={[styles.waitingText, { color: colors.textSecondary }]} numberOfLines={2}>
                  Your three are in. Theirs show here once they swap.
                </Text>
              </View>
              <NudgeButton
                name={partnerName}
                onPress={() => {
                  void Haptics.selectionAsync();
                  openChat('Your turn for our gratitude swap 💛');
                }}
              />
            </View>
          </>
        ) : (
          <>
            <GratitudeList label="You wrote" items={mine} />
            <GratitudeList label={`${partnerName} wrote`} items={theirs} accent />
          </>
        )}
      </View>

      {history.length > 0 ? (
        <View style={styles.stack}>
          <Text style={[styles.section, { color: colors.textSecondary }]}>Earlier swaps</Text>
          {history.map((g) => (
            <View key={g.date} style={[styles.card, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
              <Text style={[styles.kicker, { color: colors.textSecondary }]}>{format(parseISO(g.date), 'EEEE d MMM').toUpperCase()}</Text>
              <GratitudeList label="You" items={g.answers[me!.id]} />
              <GratitudeList label={partnerName} items={g.answers[partner!.id]} accent />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function GratitudeList({ label, items, accent }: { label: string; items?: string[]; accent?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.list, { backgroundColor: accent ? colorWithAlpha(colors.accent, 0.1) : colors.surface }]}>
      <Text style={[styles.listLabel, { color: accent ? colors.accent : colors.textSecondary }]}>{label}</Text>
      {(items ?? []).map((t, i) => (
        <Text key={i} style={[styles.listItem, { color: colors.text }]}>
          {i + 1}. {t}
        </Text>
      ))}
    </View>
  );
}

/** Both of you, with a green tick on whoever has done it. */
function Who({
  me,
  partner,
  mineDone,
  theirsDone,
}: {
  me: UserProfile | null;
  partner: UserProfile | null;
  mineDone: boolean;
  theirsDone: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.who}>
      {[
        { p: me, done: mineDone },
        { p: partner, done: theirsDone },
      ].map(({ p, done }, i) => (
        <View key={i} style={[styles.face, i > 0 && styles.faceOverlap, { borderColor: colors.surfaceElevated }]}>
          <Avatar name={p?.name} imageUrl={p?.avatar_url} size={26} />
          <View
            style={[
              styles.tick,
              { borderColor: colors.surfaceElevated, backgroundColor: done ? colors.success : colors.border },
            ]}>
            {done ? <Icon name="check" size={8} color="#fff" /> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

// ── 7 day connection ───────────────────────────────────────────────────────
// One shared week: a new day opens each day, and each of you ticks it off.

type WeekPayload = { startedOn: string; done: Record<string, string[]> };

function weekOf(row: Activity | undefined): WeekPayload | null {
  if (!row) return null;
  const p = row.payload as Partial<WeekPayload>;
  return { startedOn: String(p.startedOn ?? ''), done: (p.done as Record<string, string[]>) ?? {} };
}

export function WeekChallengeScreen() {
  const { colors } = useTheme();
  const me = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  const partnerName = getFirstName(partner?.name) ?? 'your partner';
  const { rows, relationshipId, refresh, isLoading } = useSharedActivities('week_challenge');
  const [busy, setBusy] = useState(false);

  const row = rows[0];
  const week = weekOf(row);
  // The couple's shared day (see spaceCalendarDate), so you're both on the same day's swap.
  const today = spaceCalendarDate();
  const openDays = week ? Math.min(7, Math.max(1, differenceInCalendarDays(parseISO(today), parseISO(week.startedOn)) + 1)) : 0;
  const everyone = [me?.id, partner?.id].filter(Boolean) as string[];
  const finished =
    !!week && WEEK_CHALLENGE.every((d) => everyone.every((id) => (week.done[String(d.day)] ?? []).includes(id)));

  const start = async () => {
    if (!relationshipId) return;
    setBusy(true);
    try {
      await api.createActivity(relationshipId, 'week_challenge', { startedOn: today, done: {} });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      void refresh();
    } catch (e) {
      Alert.alert('Couldn’t start', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (day: number) => {
    if (!row || !me || !relationshipId) return;
    void Haptics.selectionAsync();
    try {
      const latest = weekOf((await api.fetchActivitiesOfType(relationshipId, 'week_challenge', 1))[0]) ?? week!;
      const key = String(day);
      const list = latest.done[key] ?? [];
      const nextList = list.includes(me.id) ? list.filter((id) => id !== me.id) : [...list, me.id];
      const done = { ...latest.done, [key]: nextList };
      const allDone = WEEK_CHALLENGE.every((d) => everyone.every((id) => (done[String(d.day)] ?? []).includes(id)));
      await api.updateActivity(row.id, { payload: { ...latest, done }, status: allDone ? 'completed' : 'in_progress' });
      void refresh();
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!week || (finished && row?.status === 'completed' && differenceInCalendarDays(parseISO(today), parseISO(week.startedOn)) >= 7)) {
    return (
      <View style={styles.stack}>
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          One small habit a day for a week, done by both of you. A new day opens each morning.
        </Text>
        {WEEK_CHALLENGE.map((d) => (
          <View key={d.day} style={[styles.dayRow, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
            <Text style={[styles.dayNum, { color: colors.accent }]}>Day {d.day}</Text>
            <View style={styles.flex}>
              <Text style={[styles.dayTitle, { color: colors.text }]}>{d.title}</Text>
            </View>
          </View>
        ))}
        <PrimaryButton label={busy ? 'Starting…' : 'Start the week together'} onPress={() => void start()} loading={busy} />
      </View>
    );
  }

  return (
    <View style={styles.stack}>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        {finished
          ? `You both finished all seven days 🎉`
          : `Day ${openDays} of 7 · started ${format(parseISO(week.startedOn), 'EEE d MMM')}. Tick a day once you’ve done it.`}
      </Text>
      {WEEK_CHALLENGE.map((d) => {
        const doneBy = week.done[String(d.day)] ?? [];
        const locked = d.day > openDays;
        const mineDone = !!me && doneBy.includes(me.id);
        const theirsDone = !!partner && doneBy.includes(partner.id);
        const both = mineDone && theirsDone;
        return (
          <Pressable
            key={d.day}
            disabled={locked}
            onPress={() => void toggle(d.day)}
            accessibilityRole="button"
            accessibilityState={{ disabled: locked, checked: mineDone }}
            accessibilityLabel={`Day ${d.day}, ${d.title}${locked ? ', opens later' : mineDone ? ', done by you' : ''}`}
            style={({ pressed }) => [
              styles.dayRow,
              {
                backgroundColor: both ? colorWithAlpha(colors.accent, 0.12) : colors.surfaceElevated,
                borderColor: both ? colors.accent : colors.border,
                opacity: locked ? 0.45 : pressed ? 0.8 : 1,
              },
            ]}>
            <Text style={[styles.dayNum, { color: colors.accent }]}>Day {d.day}</Text>
            <View style={styles.flex}>
              <Text style={[styles.dayTitle, { color: colors.text }]}>{d.title}</Text>
              <Text style={[styles.dayDetail, { color: colors.textSecondary }]}>
                {locked ? (d.day === openDays + 1 ? 'Opens tomorrow' : `Opens ${format(subDays(parseISO(week.startedOn), -(d.day - 1)), 'EEE')}`) : d.detail}
              </Text>
            </View>
            {locked ? <Icon name="lock" size={16} color={colors.textTertiary} /> : <Who me={me} partner={partner} mineDone={mineDone} theirsDone={theirsDone} />}
          </Pressable>
        );
      })}
      {!finished ? (
        <Text style={[styles.foot, { color: colors.textTertiary }]}>
          Green ticks show who’s done each day: you, then {partnerName}.
        </Text>
      ) : (
        <PrimaryButton label="Start another week" onPress={() => void start()} loading={busy} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { paddingVertical: 40, alignItems: 'center' },
  stack: { gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  kicker: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  prompt: { fontSize: 19, fontWeight: '800', lineHeight: 25, letterSpacing: -0.3 },
  hint: { fontSize: 14, lineHeight: 20 },
  section: { fontSize: 14, fontWeight: '800', marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  num: { fontSize: 15, fontWeight: '900', width: 16, marginTop: 2 },
  input: { flex: 1, fontSize: 15, lineHeight: 20, minHeight: 22, padding: 0 },
  waiting: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
  },
  waitingLines: { flex: 1, gap: 2 },
  waitingTitle: { fontSize: 15, fontWeight: '800' },
  waitingText: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  list: { borderRadius: 14, padding: 12, gap: 4 },
  listLabel: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  listItem: { fontSize: 15, lineHeight: 21 },
  who: { flexDirection: 'row' },
  face: { borderWidth: 2, borderRadius: 15 },
  faceOverlap: { marginLeft: -8 },
  tick: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 14 },
  dayNum: { fontSize: 13, fontWeight: '900', width: 44 },
  dayTitle: { fontSize: 15, fontWeight: '700' },
  dayDetail: { fontSize: 13, marginTop: 2 },
  foot: { fontSize: 12, textAlign: 'center' },
});
