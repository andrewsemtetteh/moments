import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import type { PlanTask } from '@/lib/plan-local';
import { useTheme } from '@/hooks/useTheme';

export function PlanTasksCard({
  tasks,
  onToggle,
  onAdd,
}: {
  tasks: PlanTask[];
  onToggle: (id: string) => void;
  onAdd: (title: string) => void;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState('');
  const [adding, setAdding] = useState(false);

  const submit = () => {
    const title = draft.trim();
    if (!title) return;
    onAdd(title);
    setDraft('');
    setAdding(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.text }]}>Today&apos;s Tasks</Text>
        <Pressable
          onPress={() => setAdding((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Add task">
          <Icon name="plus" size={20} color={colors.accent} />
        </Pressable>
      </View>

      {tasks.length === 0 && !adding ? (
        <Text style={[styles.empty, { color: colors.textSecondary }]}>
          Little things that make the plan happen.
        </Text>
      ) : null}

      <View style={styles.list}>
        {tasks.map((task) => (
          <Animated.View key={task.id} entering={FadeIn} layout={LinearTransition.springify()}>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onToggle(task.id);
              }}
              style={styles.row}>
              <View
                style={[
                  styles.check,
                  {
                    borderColor: task.done ? colors.accent : colors.borderStrong,
                    backgroundColor: task.done ? colors.accent : 'transparent',
                  },
                ]}>
                {task.done ? <Icon name="check" size={14} color={colors.onAccent} /> : null}
              </View>
              <Text
                style={[
                  styles.title,
                  {
                    color: task.done ? colors.textTertiary : colors.text,
                    textDecorationLine: task.done ? 'line-through' : 'none',
                  },
                ]}>
                {task.title}
              </Text>
            </Pressable>
          </Animated.View>
        ))}
      </View>

      {adding ? (
        <View style={[styles.addRow, { borderColor: colors.border }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Add a task…"
            placeholderTextColor={colors.textTertiary}
            autoFocus
            onSubmitEditing={submit}
            style={[styles.input, { color: colors.text }]}
          />
          <Pressable onPress={submit} hitSlop={8}>
            <Text style={{ color: colors.accent, fontWeight: '800' }}>Add</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 20,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    gap: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heading: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  empty: { fontSize: 14, lineHeight: 20 },
  list: { gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, fontSize: 16, fontWeight: '600' },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  input: { flex: 1, fontSize: 16, fontWeight: '600', paddingVertical: 4 },
});
