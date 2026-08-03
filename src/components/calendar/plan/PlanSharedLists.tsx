import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { listProgress, type PlanList } from '@/lib/plan-local';
import { useTheme } from '@/hooks/useTheme';

export function PlanSharedLists({
  lists,
  eventTitles,
  onOpenList,
  onSeeAll,
  onCreateList,
  onRename,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  lists: PlanList[];
  eventTitles?: Record<string, string>;
  onOpenList: (listId: string) => void;
  onSeeAll?: () => void;
  onCreateList?: () => void;
  onRename?: (list: PlanList) => void;
  onDuplicate?: (list: PlanList) => void;
  onArchive?: (list: PlanList) => void;
  onDelete?: (list: PlanList) => void;
}) {
  const { colors } = useTheme();
  const preview = lists.slice(0, 3);

  const quickActions = (list: PlanList) => {
    Alert.alert(list.title, undefined, [
      { text: 'Rename', onPress: () => onRename?.(list) },
      { text: 'Duplicate', onPress: () => onDuplicate?.(list) },
      { text: 'Archive', onPress: () => onArchive?.(list) },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete?.(list) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={[styles.heading, { color: colors.text }]}>Shared lists</Text>
        {lists.length > 0 && onSeeAll ? (
          <Pressable onPress={onSeeAll} hitSlop={8}>
            <Text style={[styles.seeAll, { color: colors.accent }]}>See all</Text>
          </Pressable>
        ) : null}
      </View>

      {lists.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyBody, { color: colors.textSecondary }]}>
            Lists appear when you plan a trip, celebration, or add a checklist — or create one anytime.
          </Text>
          {onCreateList ? (
            <Pressable onPress={onCreateList} style={[styles.createBtn, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.createLabel, { color: colors.accent }]}>+ New list</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={styles.stack}>
          {preview.map((list) => {
            const { done, total, pct } = listProgress(list);
            const linked =
              list.eventId && eventTitles?.[list.eventId]
                ? eventTitles[list.eventId]
                : null;
            return (
              <Pressable
                key={list.id}
                onPress={() => onOpenList(list.id)}
                onLongPress={() => quickActions(list)}
                style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={styles.cardTop}>
                  <Text style={styles.emoji}>{list.emoji}</Text>
                  <View style={styles.cardBody}>
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                      {list.title}
                    </Text>
                    <Text style={[styles.meta, { color: colors.textTertiary }]} numberOfLines={1}>
                      {linked
                        ? `For ${linked}`
                        : total === 0
                          ? 'No items yet'
                          : `${done} / ${total} items`}
                    </Text>
                  </View>
                </View>
                <View style={[styles.track, { backgroundColor: colors.surfaceElevated }]}>
                  <View style={[styles.fill, { width: `${pct}%`, backgroundColor: colors.accent }]} />
                </View>
              </Pressable>
            );
          })}
          {onCreateList ? (
            <Pressable onPress={onCreateList} style={[styles.createBtn, { backgroundColor: colors.accentSoft }]}>
              <Text style={[styles.createLabel, { color: colors.accent }]}>+ New list</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 20, gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heading: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  seeAll: { fontSize: 14, fontWeight: '700' },
  stack: { gap: 10 },
  empty: { gap: 12 },
  emptyBody: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
  createBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  createLabel: { fontSize: 15, fontWeight: '700' },
  card: {
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  emoji: { fontSize: 22 },
  cardBody: { flex: 1, gap: 2 },
  title: { fontSize: 16, fontWeight: '700' },
  meta: { fontSize: 13, fontWeight: '500' },
  track: { height: 5, borderRadius: 999, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
});
