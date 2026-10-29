import { trackColor, insetCardStyle, separatorColor } from '@/components/ui/primitives';
import * as Haptics from '@/lib/haptics';
import { useMemo, useState } from 'react';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TextInput } from '@/components/ui/ThemedTextInput';

import { DraggableSheet, useKeptWhileClosing } from '@/components/ui/DraggableSheet';
import { Icon } from '@/components/ui/Icon';
import { listProgress, type PlanList, type PlanListItem } from '@/lib/plan-local';
import { useTheme } from '@/hooks/useTheme';

export function PlanListSheet({
  list: listProp,
  visible,
  linkedPlanTitle,
  onClose,
  onChange,
}: {
  list: PlanList | null;
  visible: boolean;
  linkedPlanTitle?: string | null;
  onClose: () => void;
  onChange: (next: PlanList) => void;
}) {
  const { colors } = useTheme();
  // Still the same list while the sheet slides away.
  const list = useKeptWhileClosing(listProp);
  const [draft, setDraft] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ sectionId: string; itemId: string } | null>(null);
  const [sectionTitleDraft, setSectionTitleDraft] = useState('');
  const [itemTitleDraft, setItemTitleDraft] = useState('');
  const progress = useMemo(() => (list ? listProgress(list) : null), [list]);

  // Closed: forget half-typed text and edits (while rendering, once per close).
  const [wasVisible, setWasVisible] = useState(visible);
  if (wasVisible !== visible) {
    setWasVisible(visible);
    if (!visible) {
      setDraft('');
      setEditingSectionId(null);
      setEditingItem(null);
    }
  }

  if (!list) return null;

  const sectionId = activeSectionId ?? list.sections[0]?.id ?? 'main';

  const toggle = (sectionKey: string, item: PlanListItem) => {
    Haptics.selectionAsync();
    onChange({
      ...list,
      sections: list.sections.map((s) =>
        s.id === sectionKey
          ? { ...s, items: s.items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)) }
          : s,
      ),
    });
  };

  const removeItem = (sectionKey: string, itemId: string) => {
    onChange({
      ...list,
      sections: list.sections.map((s) =>
        s.id === sectionKey ? { ...s, items: s.items.filter((i) => i.id !== itemId) } : s,
      ),
    });
  };

  const moveItem = (sectionKey: string, itemId: string, dir: -1 | 1) => {
    onChange({
      ...list,
      sections: list.sections.map((s) => {
        if (s.id !== sectionKey) return s;
        const idx = s.items.findIndex((i) => i.id === itemId);
        const next = idx + dir;
        if (idx < 0 || next < 0 || next >= s.items.length) return s;
        const items = [...s.items];
        const [row] = items.splice(idx, 1);
        items.splice(next, 0, row);
        return { ...s, items };
      }),
    });
  };

  const renameItem = (sectionKey: string, itemId: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onChange({
      ...list,
      sections: list.sections.map((s) =>
        s.id === sectionKey
          ? { ...s, items: s.items.map((i) => (i.id === itemId ? { ...i, title: trimmed } : i)) }
          : s,
      ),
    });
  };

  const renameSection = (sectionKey: string, title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onChange({
      ...list,
      sections: list.sections.map((s) => (s.id === sectionKey ? { ...s, title: trimmed } : s)),
    });
  };

  const addItem = () => {
    const title = draft.trim();
    if (!title) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onChange({
      ...list,
      sections: list.sections.map((s) =>
        s.id === sectionId
          ? { ...s, items: [...s.items, { id: `${Date.now()}`, title, done: false }] }
          : s,
      ),
    });
    setDraft('');
  };

  const addSection = () => {
    const id = `section-${Date.now()}`;
    onChange({
      ...list,
      sections: [...list.sections, { id, title: 'New section', items: [] }],
    });
    setActiveSectionId(id);
    setEditingSectionId(id);
  };

  return (
    <DraggableSheet visible={visible} onClose={onClose} avoidKeyboard style={styles.sheet}>
          {/* A tap on empty space closes the keyboard (fields and buttons sit on top of this). */}
          <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} accessible={false} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>
                {list.emoji} {list.title}
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [styles.close, insetCardStyle(colors, 'sheet'), pressed && { opacity: 0.7 }]}>
              <Icon name="close" size={22} color={colors.text} />
            </Pressable>
          </View>

          {progress && progress.total > 0 ? (
            <View style={[styles.track, { backgroundColor: trackColor(colors) }]}>
              <View
                style={[styles.fill, { width: `${progress.pct}%`, backgroundColor: colors.accent }]}
              />
            </View>
          ) : null}

          <View style={[styles.addField, insetCardStyle(colors, 'sheet')]}>
            <Icon name="plus" size={18} color={colors.accent} />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add item"
              placeholderTextColor={colors.textTertiary}
              onSubmitEditing={addItem}
              returnKeyType="done"
              style={[styles.input, { color: colors.text }]}
            />
            <Pressable
              onPress={addItem}
              disabled={!draft.trim()}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Add item"
              style={({ pressed }) => [
                styles.addBtn,
                { backgroundColor: colors.accent, opacity: !draft.trim() ? 0.4 : pressed ? 0.8 : 1 },
              ]}>
              <Text style={[styles.addBtnText, { color: colors.onAccent }]}>Add</Text>
            </Pressable>
          </View>

          <ScrollView alwaysBounceVertical={false} style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            {list.sections.map((section) => (
              <View key={section.id} style={styles.section}>
                {editingSectionId === section.id ? (
                  <TextInput
                    defaultValue={section.title}
                    autoFocus
                    onChangeText={setSectionTitleDraft}
                    onBlur={() => {
                      renameSection(section.id, sectionTitleDraft);
                      setEditingSectionId(null);
                    }}
                    onSubmitEditing={() => {
                      renameSection(section.id, sectionTitleDraft);
                      setEditingSectionId(null);
                    }}
                    style={[styles.sectionTitle, { color: colors.text, padding: 0 }]}
                  />
                ) : (
                  <Pressable
                    onPress={() => setActiveSectionId(section.id)}
                    onLongPress={() => {
                      setSectionTitleDraft(section.title);
                      setEditingSectionId(section.id);
                    }}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
                  </Pressable>
                )}
                {section.items.length ? (
                <View style={[styles.list, insetCardStyle(colors, 'sheet')]}>
                {section.items.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.row,
                      index < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: separatorColor(colors) },
                    ]}>
                    <Pressable onPress={() => toggle(section.id, item)} style={styles.rowMain}>
                      <View
                        style={[
                          styles.check,
                          {
                            borderColor: item.done ? colors.accent : colors.borderStrong,
                            backgroundColor: item.done ? colors.accent : 'transparent',
                          },
                        ]}>
                        {item.done ? <Icon name="check" size={14} color={colors.onAccent} /> : null}
                      </View>
                      {editingItem?.itemId === item.id ? (
                        <TextInput
                          defaultValue={item.title}
                          autoFocus
                          onChangeText={setItemTitleDraft}
                          onBlur={() => {
                            renameItem(section.id, item.id, itemTitleDraft);
                            setEditingItem(null);
                          }}
                          onSubmitEditing={() => {
                            renameItem(section.id, item.id, itemTitleDraft);
                            setEditingItem(null);
                          }}
                          style={{
                            flex: 1,
                            color: colors.text,
                            fontSize: 16,
                            fontWeight: '600',
                            padding: 0,
                          }}
                        />
                      ) : (
                        <Pressable
                          style={{ flex: 1 }}
                          onLongPress={() => {
                            setItemTitleDraft(item.title);
                            setEditingItem({ sectionId: section.id, itemId: item.id });
                          }}>
                          <Text
                            style={{
                              color: item.done ? colors.textTertiary : colors.text,
                              textDecorationLine: item.done ? 'line-through' : 'none',
                              fontSize: 16,
                              fontWeight: '600',
                            }}>
                            {item.title}
                          </Text>
                        </Pressable>
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => moveItem(section.id, item.id, -1)}
                      disabled={index === 0}
                      hitSlop={6}
                      style={{ opacity: index === 0 ? 0.3 : 1 }}>
                      <Icon name="chevronLeft" size={16} color={colors.textTertiary} />
                    </Pressable>
                    <Pressable
                      onPress={() => moveItem(section.id, item.id, 1)}
                      disabled={index === section.items.length - 1}
                      hitSlop={6}
                      style={{ opacity: index === section.items.length - 1 ? 0.3 : 1 }}>
                      <Icon name="chevronRight" size={16} color={colors.textTertiary} />
                    </Pressable>
                    <Pressable onPress={() => removeItem(section.id, item.id)} hitSlop={8}>
                      <Icon name="close" size={16} color={colors.textTertiary} />
                    </Pressable>
                  </View>
                ))}
                </View>
                ) : null}
              </View>
            ))}

            <Pressable
              onPress={addSection}
              style={({ pressed }) => [styles.addSection, insetCardStyle(colors, 'sheet'), pressed && { opacity: 0.7 }]}>
              <Icon name="plus" size={16} color={colors.accent} />
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Add section</Text>
            </Pressable>
          </ScrollView>
    </DraggableSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 20, fontWeight: '800', letterSpacing: -0.3 },
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  list: { borderRadius: 18, overflow: 'hidden' },
  track: { height: 6, borderRadius: 999, overflow: 'hidden', marginBottom: 14 },
  fill: { height: '100%', borderRadius: 999 },
  addField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 18,
    paddingHorizontal: 16,
    minHeight: 54,
    marginBottom: 16,
  },
  input: { flex: 1, fontSize: 16, fontWeight: '600', padding: 0 },
  addBtn: { height: 34, paddingHorizontal: 14, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  addBtnText: { fontSize: 14, fontWeight: '800' },
  section: { marginBottom: 18, gap: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 54,
    paddingHorizontal: 16,
  },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  check: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    minHeight: 54,
    marginBottom: 8,
  },
});
