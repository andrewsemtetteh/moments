import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useJournalEntries } from '@/hooks/queries';
import { usePlusGate } from '@/hooks/usePlusGate';
import { useSubscription } from '@/hooks/useSubscription';
import { useTheme } from '@/hooks/useTheme';
import * as api from '@/services/api';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';
import { useQueryClient } from '@tanstack/react-query';

const ENTRY_TYPES = [
  { key: 'reflection', label: 'Reflection' },
  { key: 'gratitude', label: 'Gratitude' },
  { key: 'memory', label: 'Memory' },
  { key: 'emotion', label: 'Emotion' },
  { key: 'plan', label: 'Future Plan' },
] as const;

export function JournalModal() {
  const { colors } = useTheme();
  const visible = useUIStore((s) => s.showJournal);
  const setVisible = useUIStore((s) => s.setShowJournal);
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { data: entries } = useJournalEntries();
  const { journalCount, limits } = useSubscription();
  const { requirePlus } = usePlusGate();
  const atJournalLimit = !Number.isFinite(limits.journalEntries) ? false : journalCount >= limits.journalEntries;

  const [content, setContent] = useState('');
  const [entryType, setEntryType] = useState<string>('reflection');
  const [saving, setSaving] = useState(false);

  const close = () => {
    setContent('');
    setVisible(false);
  };

  const save = async () => {
    if (!content.trim() || !relationship || !user) return;
    if (atJournalLimit && !requirePlus('Unlimited journal entries')) return;
    setSaving(true);
    try {
      await api.createJournalEntry(relationship.id, user.id, {
        content: content.trim(),
        type: entryType,
      });
      await api.trackEvent(relationship.id, user.id, 'journal_entry_created');
      queryClient.invalidateQueries({ queryKey: ['journal', relationship.id] });
      setContent('');
    } finally {
      setSaving(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Pressable onPress={close}>
            <Text style={{ color: colors.textSecondary }}>Close</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>Journal</Text>
          <Pressable onPress={save} disabled={!content.trim() || saving || atJournalLimit}>
            <Text style={{ color: colors.accent, opacity: content.trim() && !atJournalLimit ? 1 : 0.4 }}>Save</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {Number.isFinite(limits.journalEntries) && (
            <Text style={[styles.limitHint, { color: colors.textSecondary }]}>
              {Math.max(0, limits.journalEntries - journalCount)} of {limits.journalEntries} free entries remaining
            </Text>
          )}
          <View style={styles.types}>
            {ENTRY_TYPES.map((t) => (
              <Pressable
                key={t.key}
                onPress={() => setEntryType(t.key)}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: entryType === t.key ? colors.accentSoft : colors.surface,
                    borderColor: entryType === t.key ? colors.accent : colors.border,
                  },
                ]}>
                <Text style={{ color: colors.text }}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          <TextInput
            style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
            placeholder="Write what's on your heart..."
            placeholderTextColor={colors.textSecondary}
            multiline
            value={content}
            onChangeText={setContent}
            autoFocus
          />

          {entries && entries.length > 0 && (
            <View style={styles.history}>
              <Text style={[styles.historyTitle, { color: colors.textSecondary }]}>Recent entries</Text>
              {entries.slice(0, 5).map((e) => (
                <View
                  key={e.id}
                  style={[styles.entry, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={[styles.entryContent, { color: colors.text }]} numberOfLines={3}>
                    {e.content}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingTop: 20,
  },
  title: { fontSize: 17, fontWeight: '600' },
  limitHint: { fontSize: 13, fontWeight: '600' },
  content: { padding: 16, gap: 16 },
  types: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  input: {
    minHeight: 160,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    fontSize: 17,
    lineHeight: 26,
    textAlignVertical: 'top',
  },
  history: { gap: 8, marginTop: 8 },
  historyTitle: { fontSize: 13, fontWeight: '500', textTransform: 'uppercase' },
  entry: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  entryContent: { fontSize: 14, lineHeight: 20 },
});
