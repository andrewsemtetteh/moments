import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwipeDismissView } from '@/components/layout/SwipeDismissView';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { useJournalEntries } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { goBackOrReplace } from '@/lib/router';

export default function JournalScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: entries = [] } = useJournalEntries();
  const close = () => goBackOrReplace(router, '/(tabs)/home');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <SwipeDismissView edge="start" onDismiss={close}>
      <View style={styles.header}>
        <Pressable
          onPress={close}
          style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}>
          <Icon name="chevronLeft" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Journal</Text>
        <View style={styles.iconBtn} />
      </View>

      <View style={styles.body}>
        <Text style={[styles.count, { color: colors.textSecondary }]}>{entries.length} entries</Text>
        {entries.slice(0, 20).map((entry) => (
          <View key={entry.id} style={[styles.entry, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.entryType, { color: colors.accent }]}>{entry.type}</Text>
            <Text style={{ color: colors.text, lineHeight: 22 }}>{entry.content}</Text>
          </View>
        ))}
        <PrimaryButton label="New entry" onPress={() => router.push('/journal/compose' as Href)} />
      </View>
      </SwipeDismissView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  body: { flex: 1, padding: 16, gap: 12 },
  count: { fontSize: 13, fontWeight: '600', marginBottom: 4 },
  entry: { padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, gap: 6 },
  entryType: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
});
