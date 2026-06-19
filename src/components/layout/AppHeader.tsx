import * as Haptics from 'expo-haptics';
import { usePathname, useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useNotifications, useUnreadMessageCount } from '@/hooks/queries';
import { useOpenPartnerProfile } from '@/hooks/useOpenPartnerProfile';
import { useTheme } from '@/hooks/useTheme';
import { formatBadgeCount } from '@/lib/format-badge';
import { useRelationshipStore, useUIStore } from '@/stores';

const APP_NAME = 'Moments';

interface AppHeaderProps {
  showChat?: boolean;
  showWatchTogether?: boolean;
}

export function AppHeader({ showChat = true, showWatchTogether = true }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const { colors } = useTheme();
  const openWatchTogether = useUIStore((s) => s.openWatchTogether);
  const openPartnerProfile = useOpenPartnerProfile();
  const partner = useRelationshipStore((s) => s.partner);
  const { data: notifications } = useNotifications();
  const { data: unreadMessages = 0 } = useUnreadMessageCount();

  const unreadNotifications = useMemo(
    () => (notifications ?? []).filter((n) => !n.read).length,
    [notifications],
  );

  return (
    <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: colors.background }]}>
      <View style={[styles.side, styles.left]}>
        {showChat ? (
          <HeaderIconButton
            icon="messages"
            label="Open chat"
            active={pathname.includes('/chat')}
            onPress={() => router.push('/(tabs)/chat')}
            badge={unreadMessages}
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
        {showWatchTogether && (
          <HeaderIconButton
            icon="film"
            label="Watch together"
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              openWatchTogether();
            }}
            onLongPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert('Watch Together', 'Quick actions', [
                { text: 'Continue last session', onPress: () => openWatchTogether('hub') },
                { text: 'Start a watch party', onPress: () => openWatchTogether('start') },
                { text: 'View watchlist', onPress: () => openWatchTogether('watchlist') },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
          />
        )}
        <HeaderIconButton
          icon="bell"
          label={unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : 'Notifications'}
          active={pathname.includes('/notifications')}
          onPress={() => router.push('/notifications')}
          badge={unreadNotifications}
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
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  badge?: number;
  active?: boolean;
}) {
  const { colors } = useTheme();
  const showBadge = badge > 0;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => [styles.iconSlot, pressed && styles.iconPressed]}>
      <Icon
        name={icon}
        size={26}
        color={active ? colors.accent : colors.textSecondary}
        filled={active}
      />
      {showBadge && (
        <View style={[styles.badge, { backgroundColor: colors.error, borderColor: colors.background }]}>
          <Text style={[styles.badgeText, { color: '#FFFFFF' }]} numberOfLines={1}>
            {formatBadgeCount(badge)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  side: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  center: { flexShrink: 1, maxWidth: '52%', alignItems: 'center' },
  centerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '100%' },
  title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4, flexShrink: 1 },
  iconSlot: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPressed: { opacity: 0.65 },
  badge: {
    position: 'absolute',
    top: 2,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
});
