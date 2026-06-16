import { useRouter, type Href } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/ui/primitives';
import { useCreateJournalEntry } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import { goBackOrReplace } from '@/lib/router';

const TYPES = ['reflection', 'gratitude', 'memory', 'emotion', 'plan'] as const;

export default function JournalComposeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const createEntry = useCreateJournalEntry();
  const { journalCount, limits } = useSubscription();
  const { requirePlus } = usePlusGate();
  const [content, setContent] = useState('');
  const [type, setType] = useState<(typeof TYPES)[number]>('reflection');

  const atLimit = Number.isFinite(limits.journalEntries) && journalCount >= limits.journalEntries;

  const close = () => goBackOrReplace(router, '/(tabs)/home');

  const save = async () => {
    if (!content.trim()) return;
    if (atLimit && !requirePlus('Unlimited journal entries')) return;
    try {
      await createEntry.mutateAsync({ content: content.trim(), type });
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/journal' as Href);
      }
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={close}>
          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>New entry</Text>
        <Pressable onPress={save} disabled={!content.trim() || createEntry.isPending}>
          <Text style={{ color: colors.accent, fontWeight: '800', opacity: content.trim() ? 1 : 0.4 }}>Save</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.types}>
          {TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => setType(t)}
              style={[
                styles.chip,
                {
                  backgroundColor: type === t ? colors.accentSoft : colors.surface,
                  borderColor: type === t ? colors.accent : colors.border,
                },
              ]}>
              <Text style={{ color: colors.text, fontWeight: '600', textTransform: 'capitalize' }}>{t}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          value={content}
          onChangeText={setContent}
          placeholder="Write what's on your heart..."
          placeholderTextColor={colors.textTertiary}
          multiline
          autoFocus
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
        />
        <PrimaryButton label="Save entry" onPress={save} loading={createEntry.isPending} disabled={!content.trim()} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  title: { fontSize: 17, fontWeight: '800' },
  scroll: { padding: 16, gap: 14 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  input: {
    minHeight: 220,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 16,
    fontSize: 17,
    lineHeight: 26,
    textAlignVertical: 'top',
  },
});
