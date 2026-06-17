import { formatDistanceToNow } from 'date-fns';
import { Redirect, useRouter } from 'expo-router';
import { FlatList, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwipeDismissView } from '@/components/layout/SwipeDismissView';
import { Icon, type IconName } from '@/components/ui/Icon';
import { useNotifications } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { useUIStore } from '@/stores';

const TYPE_ICON: Record<string, IconName> = {
  moment: 'camera',
  message: 'chat',
  mood: 'heart',
  challenge: 'sparkles',
  streak: 'fire',
  activity: 'gamepad',
  calendar: 'calendar',
  watch_party: 'film',
  watch_party_nudge: 'film',
  watch_party_scheduled: 'calendar',
};

export default function NotificationsScreen() {
  if (Platform.OS === 'web') {
    return <Redirect href="/" />;
  }

  const router = useRouter();
  const { colors } = useTheme();
  const { data: notifications } = useNotifications();
  const openWatchTogether = useUIStore((s) => s.openWatchTogether);
  const goBack = () => router.back();

  const openNotification = (type: string) => {
    if (type === 'watch_party' || type === 'watch_party_nudge') {
      openWatchTogether();
      router.back();
    }
    if (type === 'watch_party_scheduled') {
      openWatchTogether('hub');
      router.back();
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <SwipeDismissView edge="start" onDismiss={goBack}>
      <View style={styles.header}>
        <Pressable onPress={goBack} style={[styles.iconBtn, { backgroundColor: colors.surfaceElevated }]}>
          <Icon name="chevronLeft" size={22} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Notifications</Text>
        <View style={{ width: 38 }} />
      </View>

      <FlatList
        data={notifications ?? []}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.list,
          (notifications?.length ?? 0) === 0 && styles.listEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
              <Icon name="bell" size={28} color={colors.textTertiary} />
            </View>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No notifications yet. We&apos;ll let you know when your partner reaches out.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openNotification(item.type)}
            style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.itemIcon, { backgroundColor: colors.accentSoft }]}>
              <Icon name={TYPE_ICON[item.type] ?? 'bell'} size={18} color={colors.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.itemContent, { color: colors.text }]}>{item.content}</Text>
              <Text style={[styles.itemTime, { color: colors.textTertiary }]}>
                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
              </Text>
            </View>
            {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} />}
          </Pressable>
        )}
      />
      </SwipeDismissView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: '800' },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  listEmpty: { justifyContent: 'center', alignItems: 'center' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  itemIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  itemContent: { fontSize: 15, lineHeight: 20 },
  itemTime: { fontSize: 12, marginTop: 3 },
  unreadDot: { width: 9, height: 9, borderRadius: 5 },
  empty: { alignItems: 'center', gap: 14, paddingHorizontal: 40, maxWidth: 320 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  emptyText: { textAlign: 'center', fontSize: 15, lineHeight: 21 },
});
