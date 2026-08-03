import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { listProgress, type PlanList, type PlanListItem } from '@/lib/plan-local';
import { useTheme } from '@/hooks/useTheme';

export function PlanListSheet({
  list,
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
  const [draft, setDraft] = useState('');
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<{ sectionId: string; itemId: string } | null>(null);
  const progress = useMemo(() => (list ? listProgress(list) : null), [list]);

  useEffect(() => {
    if (!visible) {
      setDraft('');
      setEditingSectionId(null);
      setEditingItem(null);
    }
  }, [visible]);

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
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.backgroundElevated }]}>
          <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>
                {list.emoji} {list.title}
              </Text>
              {linkedPlanTitle ? (
                <Text style={{ color: colors.textTertiary, fontWeight: '600', marginTop: 2 }}>
                  For {linkedPlanTitle}
                </Text>
              ) : null}
              {progress ? (
                <Text style={{ color: colors.textSecondary, fontWeight: '600', marginTop: 4 }}>
                  {progress.total === 0
                    ? 'No items yet'
                    : `${progress.done} / ${progress.total} items`}
                </Text>
              ) : null}
            </View>
            <Pressable
              onPress={onClose}
              style={[styles.close, { backgroundColor: colors.surfaceElevated }]}>
              <Icon name="close" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>

          {progress && progress.total > 0 ? (
            <View style={[styles.track, { backgroundColor: colors.surfaceElevated }]}>
              <View
                style={[styles.fill, { width: `${progress.pct}%`, backgroundColor: colors.accent }]}
              />
            </View>
          ) : null}

          <View style={[styles.addField, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="plus" size={18} color={colors.accent} />
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add item"
              placeholderTextColor={colors.textTertiary}
              onSubmitEditing={addItem}
              style={[styles.input, { color: colors.text }]}
            />
          </View>

          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
            {list.sections.map((section) => (
              <View key={section.id} style={styles.section}>
                {editingSectionId === section.id ? (
                  <TextInput
                    defaultValue={section.title}
                    autoFocus
                    onBlur={(e) => {
                      renameSection(section.id, e.nativeEvent.text);
                      setEditingSectionId(null);
                    }}
                    onSubmitEditing={(e) => {
                      renameSection(section.id, e.nativeEvent.text);
                      setEditingSectionId(null);
                    }}
                    style={[styles.sectionTitle, { color: colors.text, padding: 0 }]}
                  />
                ) : (
                  <Pressable
                    onPress={() => setActiveSectionId(section.id)}
                    onLongPress={() => setEditingSectionId(section.id)}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
                  </Pressable>
                )}
                {section.items.map((item, index) => (
                  <View key={item.id} style={styles.row}>
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
                          onBlur={(e) => {
                            renameItem(section.id, item.id, e.nativeEvent.text);
                            setEditingItem(null);
                          }}
                          onSubmitEditing={(e) => {
                            renameItem(section.id, item.id, e.nativeEvent.text);
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
                          onLongPress={() => setEditingItem({ sectionId: section.id, itemId: item.id })}>
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
            ))}

            <Pressable
              onPress={addSection}
              style={[styles.addSection, { backgroundColor: colors.accentSoft }]}>
              <Icon name="plus" size={16} color={colors.accent} />
              <Text style={{ color: colors.accent, fontWeight: '700' }}>Add section</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.4 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  track: { height: 6, borderRadius: 999, overflow: 'hidden', marginBottom: 14 },
  fill: { height: '100%', borderRadius: 999 },
  addField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  input: { flex: 1, fontSize: 16, fontWeight: '600', padding: 0 },
  section: { marginBottom: 18, gap: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
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
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 8,
  },
});
