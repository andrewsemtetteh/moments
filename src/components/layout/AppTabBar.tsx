import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getTabBarBottomPadding, TAB_BAR_FAB_OVERFLOW, TAB_BAR_HEIGHT } from '@/components/layout/tab-bar-layout';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore, useUIStore } from '@/stores';

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
  { name: 'calendar', icon: 'calendar', label: 'Plan' },
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

  const activeName = state.routes[state.index]?.name;

  if (activeName === 'chat') {
    return null;
  }

  const bottomPad = getTabBarBottomPadding(insets.bottom);
  const fill = colors.glass ? colors.surfaceGlass : colors.surfaceElevated;

  const onBarLayout = (e: LayoutChangeEvent) => {
    setBarWidth(e.nativeEvent.layout.width);
  };

  const go = (name: string) => {
    Haptics.selectionAsync();
    navigation.navigate(name);
  };

  const renderTab = (tab: { name: string; icon: IconName; label: string }) => {
    const focused = activeName === tab.name;
    const isProfile = tab.name === 'profile';

    return (
      <Pressable key={tab.name} onPress={() => go(tab.name)} style={styles.tab} hitSlop={6}>
        {isProfile ? (
          <View style={[styles.profileAvatar, focused && { borderColor: colors.accent, borderWidth: 2 }]}>
            <Avatar name={user?.name} imageUrl={user?.avatar_url} size={TAB_ICON_SIZE} />
          </View>
        ) : (
          <Icon
            name={tab.icon}
            size={TAB_ICON_SIZE}
            color={focused ? colors.accent : colors.textSecondary}
            filled={focused}
          />
        )}
        <Text style={[styles.label, { color: focused ? colors.accent : colors.textSecondary }]}>{tab.label}</Text>
      </Pressable>
    );
  };

  return (
    <View
      style={[styles.wrap, { paddingBottom: bottomPad, paddingTop: TAB_BAR_FAB_OVERFLOW }]}
      pointerEvents="box-none"
      onLayout={(e) => setTabBarOverlayHeight(Math.ceil(e.nativeEvent.layout.height))}>
      <View
        style={[styles.bar, { shadowColor: colors.shadow }]}
        onLayout={onBarLayout}
        pointerEvents="box-none">
        {barWidth > 0 && (
          <Svg
            width={barWidth}
            height={TAB_BAR_HEIGHT}
            style={StyleSheet.absoluteFill}
            pointerEvents="none">
            <Path
              d={tabBarNotchPath(barWidth, TAB_BAR_HEIGHT, CUTOUT_RADIUS)}
              fill={fill}
              stroke={colors.border}
              strokeWidth={StyleSheet.hairlineWidth}
            />
          </Svg>
        )}

        {LEFT_TABS.map(renderTab)}

        <View style={styles.center} pointerEvents="box-none">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowMomentCreator(true);
            }}
            accessibilityLabel="Create a Moment"
            style={({ pressed }) => [styles.fabPressable, pressed && { transform: [{ scale: 0.92 }] }]}>
            <LinearGradient
              colors={colors.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.fab, { shadowColor: colors.accent }]}>
              <Icon name="plus" size={TAB_ICON_SIZE} color="#fff" />
            </LinearGradient>
          </Pressable>
        </View>

        {RIGHT_TABS.map(renderTab)}
      </View>
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
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 460,
    height: TAB_BAR_HEIGHT,
    paddingHorizontal: 14,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 12,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  label: { fontSize: 10, fontWeight: '700' },
  profileAvatar: {
    width: TAB_ICON_SIZE,
    height: TAB_ICON_SIZE,
    borderRadius: TAB_ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 0,
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
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
});
