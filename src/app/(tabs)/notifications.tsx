import { Redirect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { openFromNotificationType } from '@/components/layout/NotificationSync';
import { SwipeDismissView } from '@/components/layout/SwipeDismissView';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import {
  useClearNotifications,
  useDeleteNotification,
  useMarkNotificationsRead,
  useNotificationFeed,
} from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { toUserFacingNetworkError } from '@/lib/network-error';
import {
  filterInboxNotifications,
  formatNotificationTime,
  groupNotificationsBySection,
  NOTIFICATION_TYPE_ICON,
  NOTIFICATION_TYPE_LABEL,
} from '@/lib/notification-display';
import { goBackOrReplace } from '@/lib/router';
import type { Notification } from '@/types/database';

export default function NotificationsScreen() {
  if (Platform.OS === 'web') {
    return <Redirect href="/" />;
  }

  return <NotificationsScreenNative />;
}

function NotificationsScreenNative() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const goBack = useCallback(() => {
    goBackOrReplace(router, '/(tabs)/home');
  }, [router]);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useNotificationFeed();

  const markRead = useMarkNotificationsRead();
  const deleteNotification = useDeleteNotification();
  const clearAll = useClearNotifications();
  const [pullRefreshing, setPullRefreshing] = useState(false);

  const items = useMemo(
    () => filterInboxNotifications(data?.pages.flat() ?? []),
    [data],
  );
  const sections = useMemo(() => groupNotificationsBySection(items), [items]);
  const hasItems = items.length > 0;

  const onPullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await refetch();
    } finally {
      setPullRefreshing(false);
    }
  }, [refetch]);

  const handleOpen = (item: Notification) => {
    if (!item.read) {
      markRead.mutate([item.id]);
    }
    openFromNotificationType(item.type, router);
  };

  const confirmDelete = (item: Notification) => {
    Alert.alert('Delete notification?', 'This removes it from your list.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => deleteNotification.mutate(item.id),
      },
    ]);
  };

  const confirmClearAll = () => {
    Alert.alert('Clear all notifications?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear all',
        style: 'destructive',
        onPress: () => clearAll.mutate(),
      },
    ]);
  };

  const errorMessage = toUserFacingNetworkError(
    error,
    'Could not load notifications. Please try again.',
  ).message;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SwipeDismissView edge="start" onDismiss={goBack} style={styles.flex}>
        <View style={[styles.flex, { paddingTop: insets.top + 6 }]}>
          <View style={styles.header}>
            <Pressable
              onPress={goBack}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}>
              <Icon name="chevronLeft" size={26} color={colors.textSecondary} />
            </Pressable>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              Notifications
            </Text>
          </View>

          {isLoading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={colors.accent} size="large" />
            </View>
          ) : isError ? (
            <View style={styles.centered}>
              <Text style={[styles.errorTitle, { color: colors.text }]}>Couldn&apos;t load notifications</Text>
              <Text style={[styles.errorBody, { color: colors.textSecondary }]}>{errorMessage}</Text>
              <PrimaryButton label="Try again" onPress={() => void refetch()} />
            </View>
          ) : (
            <SectionList
              sections={sections}
              keyExtractor={(item) => item.id}
              style={styles.flex}
              contentContainerStyle={[
                styles.listContent,
                { paddingBottom: insets.bottom + 24 },
                !hasItems && styles.listContentEmpty,
              ]}
              stickySectionHeadersEnabled={false}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={pullRefreshing}
                  tintColor={colors.accent}
                  colors={[colors.accent]}
                  onRefresh={() => void onPullRefresh()}
                />
              }
              ListEmptyComponent={
                <View style={styles.empty}>
                  <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceElevated }]}>
                    <Icon name="bell" size={28} color={colors.textTertiary} />
                  </View>
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>No notifications yet</Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    When your partner shares a moment, mood, plan, or streak update, it&apos;ll show up here.
                  </Text>
                </View>
              }
              renderSectionHeader={({ section: { title, key } }) => (
                <Text
                  style={[
                    styles.sectionTitle,
                    key === sections[0]?.key && styles.sectionTitleFirst,
                    { color: colors.textSecondary },
                  ]}>
                  {title}
                </Text>
              )}
              ItemSeparatorComponent={() => (
                <View style={[styles.itemSeparator, { backgroundColor: colors.border }]} />
              )}
              SectionSeparatorComponent={() => <View style={styles.sectionGap} />}
              renderItem={({ item }) => (
                <NotificationRow
                  item={item}
                  colors={colors}
                  onPress={() => handleOpen(item)}
                  onLongPress={() => confirmDelete(item)}
                />
              )}
              ListFooterComponent={
                hasNextPage ? (
                  <Pressable
                    onPress={() => void fetchNextPage()}
                    disabled={isFetchingNextPage}
                    style={[styles.loadMore, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
                    {isFetchingNextPage ? (
                      <ActivityIndicator color={colors.accent} />
                    ) : (
                      <Text style={[styles.loadMoreText, { color: colors.accent }]}>Load older notifications</Text>
                    )}
                  </Pressable>
                ) : null
              }
            />
          )}
        </View>
      </SwipeDismissView>
    </View>
  );
}

function NotificationRow({
  item,
  colors,
  onPress,
  onLongPress,
}: {
  item: Notification;
  colors: ReturnType<typeof useTheme>['colors'];
  onPress: () => void;
  onLongPress: () => void;
}) {
  const typeLabel = NOTIFICATION_TYPE_LABEL[item.type] ?? 'Update';
  const iconName = NOTIFICATION_TYPE_ICON[item.type] ?? 'bell';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      accessibilityHint="Long press to delete"
      style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
      <View style={styles.itemIcon}>
        <Icon name={iconName} size={20} color={colors.accent} />
      </View>
      <View style={styles.itemBody}>
        <View style={styles.itemMeta}>
          <Text style={[styles.itemType, { color: colors.accent }]}>{typeLabel}</Text>
          <Text style={[styles.itemTime, { color: colors.textTertiary }]}>
            {formatNotificationTime(item.created_at)}
          </Text>
        </View>
        <Text
          style={[
            styles.itemContent,
            { color: colors.text },
            !item.read && styles.itemContentUnread,
          ]}>
          {item.content}
        </Text>
      </View>
      {!item.read ? <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    minHeight: 44,
  },
  backBtn: {
    position: 'absolute',
    left: 16,
    top: 0,
    bottom: 0,
    width: 32,
    justifyContent: 'center',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  title: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  listContent: { paddingHorizontal: 16, paddingTop: 4 },
  listContentEmpty: { flexGrow: 1, justifyContent: 'center' },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 2,
  },
  sectionTitleFirst: {
    marginTop: 4,
  },
  sectionGap: { height: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  itemSeparator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 40,
  },
  itemIcon: {
    width: 28,
    height: 28,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemBody: { flex: 1, gap: 4 },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemType: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.4 },
  itemContent: { fontSize: 15, lineHeight: 21 },
  itemContentUnread: { fontWeight: '600' },
  itemTime: { fontSize: 12, fontWeight: '600', flexShrink: 0 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  empty: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 32,
    paddingVertical: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '800' },
  emptyText: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  errorBody: { fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 8 },
  loadMore: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
    marginBottom: 8,
  },
  loadMoreText: { fontSize: 14, fontWeight: '700' },
  pressed: { opacity: 0.7 },
});
