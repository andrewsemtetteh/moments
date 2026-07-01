import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getTabBarBottomPadding, TAB_BAR_FAB_OVERFLOW } from '@/components/layout/tab-bar-layout';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { Radius } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore, useUIStore } from '@/stores';

const TAB_ICON_SIZE = 28;

const LEFT_TABS: { name: string; icon: IconName; label: string }[] = [
  { name: 'home', icon: 'home', label: 'Home' },
  { name: 'activities', icon: 'gamepad', label: 'Play' },
];

const RIGHT_TABS: { name: string; icon: IconName; label: string }[] = [
  { name: 'calendar', icon: 'calendar', label: 'Plan' },
  { name: 'profile', icon: 'user', label: 'You' },
];

interface TabBarLikeProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: { navigate: (name: string) => void };
}

export function AppTabBar({ state, navigation }: TabBarLikeProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const setShowMomentCreator = useUIStore((s) => s.setShowMomentCreator);
  const setTabBarOverlayHeight = useUIStore((s) => s.setTabBarOverlayHeight);
  const user = useAuthStore((s) => s.user);

  const activeName = state.routes[state.index]?.name;

  if (activeName === 'chat') {
    return null;
  }

  const bottomPad = getTabBarBottomPadding(insets.bottom);

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
        style={[
          styles.bar,
          {
            backgroundColor: colors.glass ? colors.surfaceGlass : colors.surfaceElevated,
            borderColor: colors.border,
            shadowColor: colors.shadow,
          },
        ]}>
        {LEFT_TABS.map(renderTab)}

        <View style={styles.center}>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setShowMomentCreator(true);
            }}
            accessibilityLabel="Create a Moment"
            style={({ pressed }) => pressed && { transform: [{ scale: 0.92 }] }}>
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
    height: 64,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
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
    width: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
});
