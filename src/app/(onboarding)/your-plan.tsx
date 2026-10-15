import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { paperEdge } from '@/components/ui/primitives';
import { CoupleCharacters } from '@/components/onboarding/Characters';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { getOnboardingDraft, goNext, previewAnswers, type OnboardingDraft } from '@/lib/onboarding-v2';
import { useAuthStore } from '@/stores';

type Row = { icon: IconName; title: string; sub: string };

/** What each goal turns into in the app (shown first, in the order picked). */
const FOR_GOAL: Record<string, Row> = {
  talk: { icon: 'messages', title: 'Chat that feels like you', sub: 'For “Talk every day”: messages, voice notes and photos, in one private thread.' },
  closer: { icon: 'camera', title: 'A moment from each other, daily', sub: 'For “Feel closer apart”: their day, the second you open the app.' },
  dates: { icon: 'calendar', title: 'Plans and date nights', sub: 'For “More date nights”: plan together, get reminded, keep the memories.' },
  play: { icon: 'cards', title: 'Conversation cards and games', sub: 'For “Play together”: deep talks, would-you-rather, quizzes and live rooms with voice.' },
  remember: { icon: 'albums', title: 'Your story, kept', sub: 'For “Remember our moments”: memories, albums, your map and Wrapped.' },
  deeper: { icon: 'heart', title: 'Conversations that go deeper', sub: 'For “Deeper conversations”: questions and cards made for two.' },
};

/** Always part of Moments, whatever they picked. */
const CORE: Record<string, Row> = {
  moments: { icon: 'camera', title: 'A moment from each other, daily', sub: 'A photo or video of right now, the first thing they see.' },
  question: { icon: 'question', title: 'One question a day', sub: 'Answer, then see each other’s. Small talk becomes real talk.' },
  chat: { icon: 'messages', title: 'Your own private chat', sub: 'Messages, voice notes and photos, just for the two of you.' },
  plans: { icon: 'calendar', title: 'Plans you make together', sub: 'Date nights, trips and to-dos on one shared plan, with reminders for both.' },
  talk: { icon: 'cards', title: 'Conversations for two', sub: 'Conversation decks and games for the nights you want more than small talk.' },
  streak: { icon: 'fire', title: 'A streak to keep', sub: 'Show up together every day and watch it grow.' },
};

/** Step 5: their answers played back as a plan, plus without/with Moments. */
export default function YourPlanScreen() {
  const router = useRouter();
  const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const [draft, setDraft] = useState<OnboardingDraft>(() => (preview ? { spaceName: previewAnswers.spaceName } : {}));

  useEffect(() => {
    if (!user?.id || preview) return;
    void getOnboardingDraft(user.id).then(setDraft);
  }, [user?.id, preview]);

  const goals = draft.goals?.length ? draft.goals : ['closer', 'talk', 'play'];
  // Their goals first, then the everyday core (without repeating a feature).
  const rows: Row[] = [];
  const seen = new Set<string>();
  const add = (r?: Row) => {
    if (r && !seen.has(r.icon)) {
      seen.add(r.icon);
      rows.push(r);
    }
  };
  goals.forEach((g) => add(FOR_GOAL[g]));
  if (draft.relationshipType === 'long_distance') {
    add({ icon: 'time', title: 'Their time and distance, always there', sub: 'Long distance: you’ll know when they’re asleep and how far apart you are.' });
  }
  Object.values(CORE).forEach(add);
  const me = getFirstName(preview ? previewAnswers.name : user?.name) ?? getFirstName(user?.name) ?? 'you';
  const space = draft.spaceName?.trim();

  return (
    <OnboardingStepScreen
      step="your-plan"
      art={<CoupleCharacters width={150} />}
      title={draft.relationshipType === 'long_distance' ? 'Your plan to feel close, miles apart' : 'Your plan to feel even closer'}
      subtitle={space ? `Made for ${space}` : `Made for ${me} and your person`}
      primaryLabel="Let’s set it up"
      onPrimary={() => void goNext(router, 'your-plan', { userId: user?.id, preview })}>
      <View style={[styles.list, { borderColor: colors.text, backgroundColor: colors.surface }]}>
        {rows.map((r, i, arr) => (
          <View
            key={r.title}
            style={[styles.row, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }]}>
            <View style={[styles.tile, { backgroundColor: colors.accent }]}>
              <Icon name={r.icon} size={18} color={colors.onAccent} />
            </View>
            <View style={styles.flex}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{r.title}</Text>
              <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{r.sub}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.compare}>
        <View style={[styles.half, { backgroundColor: colors.surfaceElevated }, paperEdge(colors)]}>
          <Text style={[styles.halfTitle, { color: colors.textSecondary }]}>Without Moments</Text>
          <Text style={[styles.halfText, { color: colors.textSecondary }]}>Missed texts, the same “how was your day”.</Text>
        </View>
        <View style={[styles.half, { backgroundColor: colors.accent }]}>
          <Text style={[styles.halfTitle, { color: colors.onAccent }]}>With Moments</Text>
          <Text style={[styles.halfText, { color: colors.onAccent }]}>Each other’s day, a question to talk about, a streak to keep.</Text>
        </View>
      </View>
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { borderWidth: 2, borderRadius: 22, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 14 },
  tile: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15, fontWeight: '900' },
  rowSub: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  compare: { flexDirection: 'row', gap: 10 },
  half: { flex: 1, borderRadius: 18, padding: 14, gap: 6 },
  halfTitle: { fontSize: 13, fontWeight: '900' },
  halfText: { fontSize: 13, lineHeight: 18 },
});
