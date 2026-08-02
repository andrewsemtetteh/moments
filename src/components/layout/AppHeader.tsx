import { useFocusEffect, usePathname, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useNotifications, useUnreadMessageCount, useUnreadNotificationCount } from '@/hooks/queries';
import { useOpenPartnerProfile } from '@/hooks/useOpenPartnerProfile';
import { useTheme } from '@/hooks/useTheme';
import { formatBadgeCount } from '@/lib/format-badge';
import { filterInboxNotifications } from '@/lib/notification-display';
import { useRelationshipStore } from '@/stores';

const APP_NAME = 'Moments';
const HEADER_ICON_SIZE = 28;

interface AppHeaderProps {
  showChat?: boolean;
}

export function AppHeader({ showChat = true }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const openPartnerProfile = useOpenPartnerProfile();
  const partner = useRelationshipStore((s) => s.partner);
  const { data: unreadNotificationsCount = 0, refetch: refetchUnreadNotifications } =
    useUnreadNotificationCount();
  const { data: notifications } = useNotifications();
  const { data: unreadMessages = 0 } = useUnreadMessageCount();
  const onChatScreen = pathname.includes('/chat');
  // Never show a chat badge while already in chat, or when count isn't a positive integer.
  const chatBadge =
    onChatScreen || !Number.isFinite(unreadMessages) || unreadMessages < 1
      ? 0
      : Math.floor(unreadMessages);

  const unreadNotifications = useMemo(() => {
    const fromFeed = filterInboxNotifications(notifications ?? []).filter(
      (notification) => !notification.read,
    ).length;
    return Math.max(unreadNotificationsCount, fromFeed);
  }, [notifications, unreadNotificationsCount]);

  useFocusEffect(
    useCallback(() => {
      void refetchUnreadNotifications();
    }, [refetchUnreadNotifications]),
  );

  return (
    <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: colors.background }]}>
      <View style={[styles.side, styles.left]}>
        {showChat ? (
          <HeaderIconButton
            icon="messages"
            label="Open chat"
            active={onChatScreen}
            onPress={() => router.push('/(tabs)/chat')}
            badge={chatBadge}
          />
        ) : (
          <View style={styles.iconSlot} />
        )}
      </View>

      <Pressable
        style={styles.center}
        disabled={!partner}
        onPress={() => {
          openPartnerProfile();
        }}
        accessibilityRole="button"
        accessibilityLabel={partner ? `View ${partner.name ?? 'partner'} profile` : APP_NAME}>
        {partner ? (
          <View style={styles.centerRow}>
            <Avatar name={partner.name} imageUrl={partner.avatar_url} size={30} />
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {APP_NAME}
            </Text>
          </View>
        ) : (
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {APP_NAME}
          </Text>
        )}
      </Pressable>

      <View style={[styles.side, styles.right]}>
        <HeaderIconButton
          icon="bell"
          label={unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : 'Notifications'}
          onPress={() => router.push('/(tabs)/notifications')}
          badge={unreadNotifications}
          filledWhenActive={false}
          badgePlacement="trailing"
        />
      </View>
    </View>
  );
}

function HeaderIconButton({
  icon,
  label,
  onPress,
  onLongPress,
  badge = 0,
  active = false,
  filledWhenActive = true,
  badgePlacement = 'default',
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  badge?: number;
  active?: boolean;
  filledWhenActive?: boolean;
  badgePlacement?: 'default' | 'trailing';
}) {
  const { colors } = useTheme();
  const count = Number.isFinite(badge) && badge >= 1 ? Math.floor(badge) : 0;
  const showBadge = count >= 1;
  const isHighlighted = active && filledWhenActive;
  const badgePositionStyle =
    badgePlacement === 'trailing' ? styles.badgeTrailing : styles.badgeDefault;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => [styles.iconSlot, pressed && styles.iconPressed]}>
      <View style={styles.iconWrap}>
        <Icon
          name={icon}
          size={HEADER_ICON_SIZE}
          color={isHighlighted ? colors.accent : colors.textSecondary}
          filled={isHighlighted}
        />
        {showBadge ? (
          <View
            style={[
              styles.badge,
              badgePositionStyle,
              { backgroundColor: colors.error, borderColor: colors.background },
            ]}>
            <Text style={[styles.badgeText, { color: '#FFFFFF' }]} numberOfLines={1}>
              {formatBadgeCount(count)}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingBottom: 8,
    overflow: 'visible',
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    overflow: 'visible',
  },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end', paddingRight: 2 },
  center: { flexShrink: 1, maxWidth: '52%', alignItems: 'center' },
  centerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4, flexShrink: 1 },
  iconSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  iconWrap: {
    width: HEADER_ICON_SIZE,
    height: HEADER_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  iconPressed: { opacity: 0.65 },
  badge: {
    position: 'absolute',
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeDefault: {
    top: -8,
    right: -10,
  },
  badgeTrailing: {
    top: -8,
    right: -4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 14,
  },
});
