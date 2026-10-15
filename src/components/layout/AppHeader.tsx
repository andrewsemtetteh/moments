import { isSameDay } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HEADER_ICON_SIZE } from '@/components/ui/HeaderIconButton';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Wordmark } from '@/components/ui/Wordmark';
// Partner avatar + name are hidden in the header for now (see below).
// import { Avatar } from '@/components/ui/primitives';
import { useMinuteTick } from '@/hooks/useMinuteTick';
import { useCalendarEvents, useNotifications, useUnreadNotificationCount } from '@/hooks/queries';
import { useOpenPartnerProfile } from '@/hooks/useOpenPartnerProfile';
import { usePartnerPresence } from '@/hooks/usePartnerPresence';
import { useTheme } from '@/hooks/useTheme';
import { formatBadgeCount } from '@/lib/format-badge';
// import { getFirstName } from '@/lib/avatar-initial';
import { formatDistanceApart, haversineDistanceKm } from '@/lib/distance';
import { hasValidCoords } from '@/lib/location';
import { isHiddenFrom } from '@/lib/plan-day';
import { isPlanCompleted } from '@/lib/plan-meta';
import { openCalendar } from '@/lib/router';
import { filterInboxNotifications } from '@/lib/notification-display';
import { buildPartnerHeaderLine, formatPartnerClock } from '@/lib/partner-header-line';
import { useAuthStore, useRelationshipStore } from '@/stores';

const APP_NAME = 'Moments';

interface AppHeaderProps {
  /** Plan (calendar) shortcut in the left slot. */
  showPlan?: boolean;
  /** Home: the header sits on the intro card's band (its colour and text colour). */
  band?: { background: string; ink: string };
}

export function AppHeader({ showPlan = true, band }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const openPartnerProfile = useOpenPartnerProfile();
  const relationship = useRelationshipStore((s) => s.relationship);
  const partner = useRelationshipStore((s) => s.partner);
  const user = useAuthStore((s) => s.user);
  // Keeps `partner` (location/online-status fields) fresh via realtime subscriptions;
  // the returned view is unused here since the meta line below covers status display.
  usePartnerPresence(relationship?.id, user?.id, partner?.id);
  const { data: unreadNotificationsCount = 0, refetch: refetchUnreadNotifications } =
    useUnreadNotificationCount();
  const { data: notifications } = useNotifications();
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

  // Re-render on each real minute boundary (and on foreground) so the partner's
  // local clock and "X minutes ago" status stay live instead of freezing at mount time.
  useMinuteTick();

  // Today's plans still to do, same "done" rule as the Together agenda.
  // A partner's private plans ("Busy") aren't yours to finish, so they don't count.
  const { data: monthPlans } = useCalendarEvents();
  const now = new Date();
  const openPlansToday = (monthPlans ?? []).filter(
    (e) => isSameDay(new Date(e.date_time), now) && !isHiddenFrom(e, user?.id) && !isPlanCompleted(e, now),
  ).length;

  const sharesLocation = Boolean(user?.location_sharing_enabled && partner?.location_sharing_enabled);
  const distanceApart = useMemo(() => {
    if (!sharesLocation) return null;
    if (!hasValidCoords(user?.location_latitude, user?.location_longitude)) return null;
    if (!hasValidCoords(partner?.location_latitude, partner?.location_longitude)) return null;
    const km = haversineDistanceKm(
      { latitude: user!.location_latitude!, longitude: user!.location_longitude! },
      { latitude: partner!.location_latitude!, longitude: partner!.location_longitude! },
    );
    return formatDistanceApart(km);
  }, [sharesLocation, user, partner]);
  const partnerClock = formatPartnerClock(partner?.timezone);
  const metaLine = buildPartnerHeaderLine({
    location: distanceApart,
    clock: partnerClock,
  });
  // const partnerFirstName = getFirstName(partner?.name);

  return (
    <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: band?.background ?? colors.background }]}>
      <View style={[styles.side, styles.left]}>
        {showPlan ? (
          <HeaderIconButton
            icon="calendar"
            label={
              openPlansToday > 0
                ? `Open Together, ${openPlansToday} ${openPlansToday === 1 ? 'plan' : 'plans'} left today`
                : 'Open Together'
            }
            onPress={() => openCalendar()}
            badge={openPlansToday}
            filledWhenActive={false}
            band={band}
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
          // Paired: only the distance/clock line — no app name, avatar or partner name.
          <View style={styles.centerRow}>
            {/* Hidden for now — kept to bring back easily:
            <Avatar name={partner.name} imageUrl={partner.avatar_url} size={34} />
            */}
            <View style={styles.centerText}>
              {/* Hidden for now — partner's first name above the distance/clock line:
              {partnerFirstName ? (
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                  {partnerFirstName}
                </Text>
              ) : null}
              */}
              {metaLine ? (
                <Text style={[styles.title, { color: band?.ink ?? colors.text }]} numberOfLines={1}>
                  {metaLine}
                </Text>
              ) : null}
            </View>
          </View>
        ) : (
          // Not paired yet: the logo (mark + name) in the middle of the bar.
          <Wordmark size={18} color={band?.ink} />
        )}
      </Pressable>

      <View style={[styles.side, styles.right]}>
        <HeaderIconButton
          icon="bell"
          label={unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : 'Notifications'}
          onPress={() => router.navigate('/notifications')}
          badge={unreadNotifications}
          filledWhenActive={false}
          badgePlacement="trailing"
          band={band}
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
  band,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  onLongPress?: () => void;
  badge?: number;
  active?: boolean;
  filledWhenActive?: boolean;
  badgePlacement?: 'default' | 'trailing';
  band?: { background: string; ink: string };
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
          color={isHighlighted ? colors.accent : (band?.ink ?? colors.text)}
          filled={isHighlighted}
        />
        {showBadge ? (
          <View
            style={[
              styles.badge,
              badgePositionStyle,
              // "9+" needs a fixed wider pill: the icon's narrow box would otherwise squeeze it to "9…".
              count > 9 && styles.badgeWide,
              { backgroundColor: colors.error, borderColor: band?.background ?? colors.background },
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
  centerText: { flexShrink: 1, minWidth: 0 },
  // Was 12px / 9px — below comfortable reading size, especially the 9px status line.
  title: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2, flexShrink: 1, lineHeight: 21 },
  meta: { fontSize: 12, fontWeight: '600', flexShrink: 1, lineHeight: 15 },
  appName: { fontSize: 17, fontWeight: '700', letterSpacing: -0.2 },
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
  // Same size as the tab bar's unread badge, so counts look identical app-wide.
  badge: {
    position: 'absolute',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeWide: { width: 26, paddingHorizontal: 0 },
  badgeDefault: {
    top: -6,
    right: -9,
  },
  badgeTrailing: {
    top: -6,
    right: -6,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 12,
  },
});
