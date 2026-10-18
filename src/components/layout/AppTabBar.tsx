import * as Haptics from '@/lib/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getTabBarBottomPadding, TAB_BAR_FAB_OVERFLOW, TAB_BAR_HEIGHT } from '@/components/layout/tab-bar-layout';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useUnreadMessageCount } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { formatBadgeCount } from '@/lib/format-badge';
import { openChat } from '@/lib/router';
import { useAuthStore, useUIStore } from '@/stores';
import { TourTarget } from '@/components/layout/TourTarget';

const TAB_ICON_SIZE = 28;
const FAB_SIZE = 56;
/** Transparent ring between the FAB and the tab bar cutout. */
const FAB_GAP = 8;
const CUTOUT_RADIUS = FAB_SIZE / 2 + FAB_GAP;

const LEFT_TABS: { name: string; icon: IconName; label: string }[] = [
  { name: 'home', icon: 'home', label: 'Home' },
  { name: 'activities', icon: 'people', label: 'Play' },
];

const RIGHT_TABS: { name: string; icon: IconName; label: string }[] = [
  { name: 'chat', icon: 'chat', label: 'Chat' },
  { name: 'profile', icon: 'user', label: 'You' },
];

interface TabBarLikeProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
}

/** Pill outline with a circular notch so the FAB sits in transparent space. */
function tabBarNotchPath(width: number, height: number, cutoutRadius: number) {
  const r = height / 2;
  const cx = width / 2;
  const cr = cutoutRadius;

  return [
    // Top edge → left side of notch
    `M ${r} 0`,
    `H ${cx - cr}`,
    // Notch dips into the bar (transparent gap around the FAB)
    `A ${cr} ${cr} 0 0 0 ${cx + cr} 0`,
    // Top edge continues → right end
    `H ${width - r}`,
    `A ${r} ${r} 0 0 1 ${width} ${r}`,
    `V ${height - r}`,
    `A ${r} ${r} 0 0 1 ${width - r} ${height}`,
    `H ${r}`,
    `A ${r} ${r} 0 0 1 0 ${height - r}`,
    `V ${r}`,
    `A ${r} ${r} 0 0 1 ${r} 0`,
    'Z',
  ].join(' ');
}

export function AppTabBar({ state, navigation }: TabBarLikeProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const setShowMomentCreator = useUIStore((s) => s.setShowMomentCreator);
  const setTabBarOverlayHeight = useUIStore((s) => s.setTabBarOverlayHeight);
  const user = useAuthStore((s) => s.user);
  const [barWidth, setBarWidth] = useState(0);
  const { data: unreadMessages = 0 } = useUnreadMessageCount();

  const activeName = state.routes[state.index]?.name;

  const bottomPad = getTabBarBottomPadding(insets.bottom);
  // The soft themes: a white bar with a visible edge and a soft shadow, so it stands off the white page.
  const fill = colors.glass ? colors.surfaceGlass : colors.sticker ? colors.background : colors.surfaceElevated;
  const activeColor = colors.accent;

  const onBarLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  const go = (name: string) => {
    Haptics.selectionAsync();
    // Chat isn't a tab route — it's a full-screen stack screen pushed over the tabs.
    if (name === 'chat') openChat();
    else navigation.navigate(name);
  };

  const renderTab = (tab: { name: string; icon: IconName; label: string }) => {
    const focused = activeName === tab.name;
    const isProfile = tab.name === 'profile';
    const badge =
      tab.name === 'chat' && Number.isFinite(unreadMessages) && unreadMessages >= 1 ? Math.floor(unreadMessages) : 0;

    return (
      <Pressable
        key={tab.name}
        onPress={() => go(tab.name)}
        style={styles.tab}
        hitSlop={6}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={badge > 0 ? `${tab.label}, ${badge} unread` : tab.label}>
        {isProfile ? (
          // The ring is always there (just transparent when unselected), so the
          // avatar never shifts or shrinks when the tab is selected — previously
          // the border was added on focus and squeezed the avatar inside it.
          <View style={[styles.profileAvatar, { borderColor: focused ? activeColor : 'transparent' }]}>
            <Avatar name={user?.name} imageUrl={user?.avatar_url} size={TAB_ICON_SIZE} />
          </View>
        ) : (
          <View>
            <Icon
              name={tab.icon}
              size={TAB_ICON_SIZE}
              color={focused ? activeColor : colors.textSecondary}
              filled={focused}
            />
            {badge > 0 ? (
              <View
                style={[styles.badge, badge > 9 && styles.badgeWide, { backgroundColor: colors.error, borderColor: fill }]}>
                <Text style={styles.badgeText} numberOfLines={1}>
                  {formatBadgeCount(badge)}
                </Text>
              </View>
            ) : null}
          </View>
        )}
        <Text style={[styles.label, { color: focused ? activeColor : colors.textSecondary }, colors.sticker && focused && styles.labelOn]}>
          {tab.label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[styles.wrap, { paddingBottom: bottomPad, paddingTop: TAB_BAR_FAB_OVERFLOW }]}
      pointerEvents="box-none"
      onLayout={(e) => setTabBarOverlayHeight(Math.ceil(e.nativeEvent.layout.height))}>
      <TourTarget name="tour-tabs" style={styles.barTarget}>
        <View style={[styles.bar, colors.sticker && !colors.isDark && styles.barShadow]} onLayout={onBarLayout} pointerEvents="box-none">
          {barWidth > 0 && (
            <Svg width={barWidth} height={TAB_BAR_HEIGHT} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Path
                d={tabBarNotchPath(barWidth, TAB_BAR_HEIGHT, CUTOUT_RADIUS)}
                fill={fill}
                stroke={colors.sticker ? colors.borderStrong : colors.border}
                strokeWidth={colors.boldBorder ? 2 : colors.sticker ? 1 : StyleSheet.hairlineWidth}
              />
            </Svg>
          )}

          {LEFT_TABS.map(renderTab)}

          <View style={styles.center} pointerEvents="box-none">
            <TourTarget name="tour-camera">
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  setShowMomentCreator(true);
                }}
                accessibilityLabel="Create a Moment"
                style={({ pressed }) => [styles.fabPressable, pressed && { transform: [{ scale: 0.92 }] }]}>
                {colors.sticker ? (
                  <View style={[styles.fab, { backgroundColor: colors.accent }]}>
                    <Icon name="plus" size={TAB_ICON_SIZE} color={colors.onAccent} />
                  </View>
                ) : (
                  <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fab}>
                    <Icon name="plus" size={TAB_ICON_SIZE} color={colors.onAccent} />
                  </LinearGradient>
                )}
              </Pressable>
            </TourTarget>
          </View>

          {RIGHT_TABS.map(renderTab)}
        </View>
      </TourTarget>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  barTarget: { width: '100%', maxWidth: 460 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 460,
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 14,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: { fontSize: 11, fontWeight: '700' },
  labelOn: { fontWeight: '900' },
  barShadow: {
    shadowColor: '#000000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // "9+" needs a fixed wider pill: the icon's narrow box would otherwise squeeze it to "9…".
  badgeWide: { width: 26, paddingHorizontal: 0 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800', lineHeight: 12 },
  // The photo is as big as the other tabs' icons (28); its 2pt selection ring sits
  // outside it, overlapping 2pt above and below so the label lines up with the rest.
  profileAvatar: {
    width: TAB_ICON_SIZE + 4,
    height: TAB_ICON_SIZE + 4,
    borderRadius: (TAB_ICON_SIZE + 4) / 2,
    marginVertical: -2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
  },
  center: {
    width: CUTOUT_RADIUS * 2,
    height: TAB_BAR_HEIGHT,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  fabPressable: {
    // Center the FAB on the cutout (cutout sits on the bar’s top edge)
    marginTop: -FAB_SIZE / 2,
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
