import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { StreakMilestoneSync } from '@/components/home/StreakMilestoneSync';
import { AppTabBar } from '@/components/layout/AppTabBar';
import { NotificationSync } from '@/components/layout/NotificationSync';
import { PartnerProfileModal } from '@/components/profile/PartnerProfileModal';
import { WatchTogetherModal } from '@/components/watch/WatchTogetherModal';
import { useRealtimeSubscription } from '@/hooks/queries';
import { useAuthStore } from '@/stores';

function TabsRealtimeSync() {
  useRealtimeSubscription('streaks');
  return null;
}

export default function TabsLayout() {
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);

  if (Platform.OS === 'web') {
    return <Redirect href="/" />;
  }

  if (!isLoading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <>
      <TabsRealtimeSync />
      <NotificationSync />
      <StreakMilestoneSync />
      <Tabs
        tabBar={(props) => <AppTabBar {...props} />}
        screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="home" />
        <Tabs.Screen name="activities" />
        <Tabs.Screen name="calendar" />
        <Tabs.Screen name="profile" />
        {/* Chat is reachable from the header, not the tab bar */}
        <Tabs.Screen name="chat" options={{ href: null }} />
      </Tabs>
      <WatchTogetherModal />
      <PartnerProfileModal />
    </>
  );
}
