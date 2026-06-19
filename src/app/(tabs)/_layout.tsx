import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { AppTabBar } from '@/components/layout/AppTabBar';
import { PartnerProfileModal } from '@/components/profile/PartnerProfileModal';
import { WatchTogetherModal } from '@/components/watch/WatchTogetherModal';

export default function TabsLayout() {
  if (Platform.OS === 'web') {
    return <Redirect href="/" />;
  }

  return (
    <>
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
