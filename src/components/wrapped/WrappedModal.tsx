import { format } from 'date-fns';
import { LinearGradient } from 'expo-linear-gradient';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { MOOD_EMOJI, MOOD_LABELS } from '@/constants/design-system';
import { useJournalEntries, useMoments, useMoodFrequency, useStreak } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';

export function WrappedModal() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const visible = useUIStore((s) => s.showWrapped);
  const setVisible = useUIStore((s) => s.setShowWrapped);
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);
  const { isPlus, requirePlus } = usePlusGate();
  const { data: momentsData } = useMoments();
  const { data: streak } = useStreak();
  const { data: journalEntries } = useJournalEntries();
  const { data: moodFreq = [] } = useMoodFrequency();

  if (!visible) return null;

  const year = new Date().getFullYear();
  const moments = momentsData?.pages.flat() ?? [];
  const topMood = moodFreq[0];
  const close = () => setVisible(false);

  if (!isPlus) {
    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={styles.header}>
            <Pressable onPress={close}>
              <Text style={{ color: colors.textSecondary }}>Close</Text>
            </Pressable>
            <Text style={[styles.title, { color: colors.text }]}>Wrapped {year}</Text>
            <View style={{ width: 48 }} />
          </View>
          <View style={styles.preview}>
            <LinearGradient colors={colors.gradient} style={styles.previewCard}>
              <Text style={styles.previewEyebrow}>Moments Plus</Text>
              <Text style={styles.previewTitle}>Your year together, beautifully summarized</Text>
              <Text style={styles.previewBody}>
                Relive your top moods, streaks, moments, and journal highlights in a private recap for just the two of
                you.
              </Text>
            </LinearGradient>
            <PrimaryButton label="Unlock Wrapped" onPress={() => requirePlus('Wrapped recap')} />
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={close}>
            <Text style={{ color: colors.textSecondary }}>Close</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Wrapped {year}</Text>
          <View style={{ width: 48 }} />
        </View>
        <ScrollView contentContainerStyle={styles.scroll}>
          <LinearGradient colors={colors.gradient} style={styles.hero}>
            <Text style={styles.heroEyebrow}>{relationship?.relationship_name ?? 'Moments'}</Text>
            <Text style={styles.heroTitle}>
              {user?.name?.split(' ')[0] ?? 'You'} & {partner?.name?.split(' ')[0] ?? 'your partner'}
            </Text>
            <Text style={styles.heroSub}>Your private {year} recap</Text>
          </LinearGradient>
          <StatCard colors={colors} label="Moments shared" value={String(moments.length)} icon="camera" />
          <StatCard colors={colors} label="Longest streak" value={`${streak?.longest_streak ?? 0} days`} icon="star" />
          <StatCard colors={colors} label="Journal entries" value={String(journalEntries?.length ?? 0)} icon="journal" />
          {topMood ? (
            <StatCard
              colors={colors}
              label="Top mood"
              value={`${MOOD_EMOJI[topMood] ?? '✨'} ${MOOD_LABELS[topMood] ?? topMood}`}
              icon="heart"
            />
          ) : null}
          <Text style={[styles.footer, { color: colors.textTertiary }]}>
            Generated {format(new Date(), 'MMM d, yyyy')} · just for you two
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function StatCard({
  label,
  value,
  icon,
  colors,
}: {
  label: string;
  value: string;
  icon: 'camera' | 'star' | 'journal' | 'heart';
  colors: ReturnType<typeof useTheme>['colors'];
}) {
  return (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Icon name={icon} size={22} color={colors.accent} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12 },
  title: { fontSize: 17, fontWeight: '700' },
  preview: { flex: 1, padding: 24, justifyContent: 'center', gap: 20 },
  previewCard: { borderRadius: 24, padding: 24 },
  previewEyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  previewTitle: { color: '#fff', fontSize: 24, fontWeight: '800', marginTop: 8, lineHeight: 30 },
  previewBody: { color: 'rgba(255,255,255,0.92)', fontSize: 15, lineHeight: 22, marginTop: 10 },
  scroll: { padding: 16, gap: 12, paddingBottom: 40 },
  hero: { borderRadius: 24, padding: 24, marginBottom: 8 },
  heroEyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800', marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 15, marginTop: 6 },
  statCard: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  statLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.4 },
  statValue: { fontSize: 18, fontWeight: '800', marginTop: 2 },
  footer: { textAlign: 'center', fontSize: 12, marginTop: 8 },
});
