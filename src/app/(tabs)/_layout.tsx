import { Redirect, Tabs } from 'expo-router';
import { Platform } from 'react-native';

import { StreakMilestoneSync } from '@/components/home/StreakMilestoneSync';
import { BirthdaySync } from '@/components/home/BirthdayCelebration';
import { TogetherMilestoneSync } from '@/components/home/TogetherMilestone';
import { StreakReminderSync } from '@/components/home/StreakReminderSync';
import { StreakSparkSync } from '@/components/home/StreakSparkSync';
import { AppTabBar } from '@/components/layout/AppTabBar';
import { ChatMessageSync } from '@/components/layout/ChatMessageSync';
import { EntryStackReset } from '@/components/layout/EntryStackReset';
import { LiveLocationSync } from '@/components/layout/LiveLocationSync';
import { PaywallMoments } from '@/components/layout/PaywallMoments';
import { PlaySync } from '@/components/layout/PlaySync';
import { PlanReminderSync } from '@/components/layout/PlanReminderSync';
import { PendingInviteSync } from '@/components/layout/PendingInviteSync';
import { HomeSync } from '@/components/layout/HomeSync';
import { NotificationSync } from '@/components/layout/NotificationSync';
import { OnboardingTour } from '@/components/layout/OnboardingTour';
import { StoreReviewSync } from '@/components/layout/StoreReviewSync';
import { WidgetSync } from '@/components/layout/WidgetSync';
import { PartnerPresenceSync } from '@/components/profile/PartnerPresenceSync';
import { PartnerTimezoneSync } from '@/components/profile/PartnerTimezoneSync';
import { RelationshipReminderSync } from '@/components/profile/RelationshipReminderSync';
import { useRealtimeSubscription } from '@/hooks/queries';
import { useTheme } from '@/hooks/useTheme';
import { useAuthStore } from '@/stores';

function TabsRealtimeSync() {
  useRealtimeSubscription('streaks');
  return null;
}

export default function TabsLayout() {
  const session = useAuthStore((s) => s.session);
  const isLoading = useAuthStore((s) => s.isLoading);
  const { colors } = useTheme();

  if (Platform.OS === 'web') {
    return <Redirect href="/" />;
  }

  if (!isLoading && !session) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <>
      <TabsRealtimeSync />
      {/* Back from Home never returns to sign-in or onboarding. */}
      <EntryStackReset />
      {/* "How far apart" stays live everywhere. */}
      <LiveLocationSync />
      <HomeSync />
      <NotificationSync />
      <ChatMessageSync />
      <PlaySync />
      {/* Reminders for upcoming plans, on this phone. */}
      <PlanReminderSync />
      {/* A partner's invite link, opened while signed in. */}
      <PendingInviteSync />
      <PaywallMoments />
      <PartnerPresenceSync />
      <PartnerTimezoneSync />
      <RelationshipReminderSync />
      <StreakMilestoneSync />
      {/* Days in a row you both checked in: 7, 30, 100, 365. */}
      <TogetherMilestoneSync />
      <BirthdaySync />
      <StreakSparkSync />
      <StreakReminderSync />
      <StoreReviewSync />
      <WidgetSync />
      {/* Runs once, right after onboarding. */}
      <OnboardingTour />
      <Tabs
        backBehavior="history"
        tabBar={(props) => <AppTabBar {...props} />}
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.background },
        }}>
        <Tabs.Screen name="home" />
        <Tabs.Screen name="activities" />
        <Tabs.Screen name="profile" />
        {/* Chat (tab-bar button), Plan and Notifications (header buttons) are
            root stack screens pushed over these tabs, not tabs themselves. */}
      </Tabs>
    </>
  );
}
