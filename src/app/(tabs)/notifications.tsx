import { Image } from 'expo-image';
import { Redirect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

import { SwipeDismissView } from '@/components/layout/SwipeDismissView';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import {
  useDeleteNotification,
  useMarkNotificationsRead,
  useMoments,
  useNotificationFeed,
} from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { toUserFacingNetworkError } from '@/lib/network-error';
import {
  filterInboxNotifications,
  formatNotificationContent,
  formatNotificationTime,
  groupNotificationsBySection,
  NOTIFICATION_TYPE_ICON,
  NOTIFICATION_TYPE_LABEL,
} from '@/lib/notification-display';
import {
  notificationNavTargetFromRow,
  openFromNotification,
} from '@/lib/notification-navigation';
import { goBackOrReplace } from '@/lib/router';
import { useAuthStore, useRelationshipStore } from '@/stores';
import type { Moment, Notification } from '@/types/database';

type InboxFilter = 'all' | 'unread';

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
  const userId = useAuthStore((s) => s.user?.id);
  const partnerId = useRelationshipStore((s) => s.partner?.id);
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

  const { data: moments = [] } = useMoments();
  const markRead = useMarkNotificationsRead();
  const deleteNotification = useDeleteNotification();
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<InboxFilter>('all');

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const items = useMemo(
    () => filterInboxNotifications(data?.pages.flat() ?? []),
    [data],
  );

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const filteredItems = useMemo(() => {
    if (filter === 'unread') return items.filter((n) => !n.read);
    return items;
  }, [filter, items]);

  const momentThumbByNotificationId = useMemo(
    () => buildMomentThumbMap(filteredItems, moments, partnerId, userId),
    [filteredItems, moments, partnerId, userId],
  );

  const sections = useMemo(
    () => groupNotificationsBySection(filteredItems, now),
    [filteredItems, now],
  );
  const hasItems = filteredItems.length > 0;

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
    void openFromNotification(notificationNavTargetFromRow(item), router);
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

          <View style={styles.filterRow}>
            <FilterPill
              label="All"
              selected={filter === 'all'}
              onPress={() => setFilter('all')}
              colors={colors}
            />
            <FilterPill
              label="Unread"
              selected={filter === 'unread'}
              onPress={() => setFilter('unread')}
              colors={colors}
              showDot={unreadCount > 0 && filter !== 'unread'}
            />
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
                  <Text style={[styles.emptyTitle, { color: colors.text }]}>
                    {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
                  </Text>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {filter === 'unread'
                      ? "You're all caught up."
                      : "When your partner shares a moment, mood, plan, or streak update, it'll show up here."}
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
                  now={now}
                  momentThumbUri={
                    item.type === 'moment'
                      ? (item.media_url ?? momentThumbByNotificationId.get(item.id) ?? null)
                      : null
                  }
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

function FilterPill({
  label,
  selected,
  onPress,
  colors,
  showDot = false,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  showDot?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.filterPill,
        {
          backgroundColor: selected ? colors.text : colors.surface,
          borderColor: selected ? colors.text : colors.border,
        },
      ]}>
      <Text style={[styles.filterPillText, { color: selected ? colors.background : colors.text }]}>
        {label}
      </Text>
      {showDot ? <View style={[styles.filterDot, { backgroundColor: colors.error }]} /> : null}
    </Pressable>
  );
}

function NotificationRow({
  item,
  colors,
  now,
  momentThumbUri,
  onPress,
  onLongPress,
}: {
  item: Notification;
  colors: ReturnType<typeof useTheme>['colors'];
  now: number;
  momentThumbUri: string | null;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const isMoment = item.type === 'moment';
  const body = formatNotificationContent(item.content);
  const time = formatNotificationTime(item.created_at, now);

  // Moment alerts only: title + time on the left, thumbnail on the right.
  if (isMoment) {
    return (
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={400}
        accessibilityHint="Long press to delete"
        style={({ pressed }) => [styles.momentItem, pressed && styles.pressed]}>
        <View style={styles.momentBody}>
          <Text
            style={[
              styles.momentTitle,
              { color: colors.text },
              !item.read && styles.itemContentUnread,
            ]}
            numberOfLines={2}>
            {body}
          </Text>
          <Text style={[styles.momentTime, { color: colors.textTertiary }]}>{time}</Text>
        </View>
        {momentThumbUri ? (
          <Image
            source={{ uri: momentThumbUri }}
            style={styles.momentThumb}
            contentFit="cover"
            transition={120}
          />
        ) : (
          <View style={[styles.momentThumbFallback, { backgroundColor: colors.accentSoft }]}>
            <Icon name="camera" size={20} color={colors.accent} />
          </View>
        )}
        {!item.read ? <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} /> : null}
      </Pressable>
    );
  }

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
          <Text style={[styles.itemTime, { color: colors.textTertiary }]}>{time}</Text>
        </View>
        <Text
          style={[
            styles.itemContent,
            { color: colors.text },
            !item.read && styles.itemContentUnread,
          ]}>
          {body}
        </Text>
      </View>
      {!item.read ? <View style={[styles.unreadDot, { backgroundColor: colors.accent }]} /> : null}
    </Pressable>
  );
}

function buildMomentThumbMap(
  notifications: Notification[],
  moments: Moment[],
  partnerId?: string | null,
  userId?: string | null,
): Map<string, string> {
  const map = new Map<string, string>();
  const momentNotifs = notifications.filter((n) => n.type === 'moment' && !n.media_url);
  if (momentNotifs.length === 0 || moments.length === 0) return map;

  const visuals = moments.filter(
    (m) =>
      !!m.media_url &&
      (!partnerId || m.user_id === partnerId || (userId ? m.user_id !== userId : true)),
  );

  for (const notif of momentNotifs) {
    if (notif.related_id) {
      const byId = visuals.find((m) => m.id === notif.related_id);
      if (byId?.media_url) {
        map.set(notif.id, byId.media_url);
        continue;
      }
    }

    const t = new Date(notif.created_at).getTime();
    let best: Moment | null = null;
    let bestDelta = Number.POSITIVE_INFINITY;
    for (const moment of visuals) {
      const delta = Math.abs(new Date(moment.created_at).getTime() - t);
      if (delta < bestDelta && delta < 5 * 60_000) {
        best = moment;
        bestDelta = delta;
      }
    }
    if (best?.media_url) map.set(notif.id, best.media_url);
  }

  return map;
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterPillText: {
    fontSize: 14,
    fontWeight: '700',
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
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
  momentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 6,
    paddingBottom: 10,
    paddingRight: 4,
  },
  momentBody: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  momentTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  momentTime: {
    fontSize: 12,
    fontWeight: '600',
  },
  momentThumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
  },
  momentThumbFallback: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
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
