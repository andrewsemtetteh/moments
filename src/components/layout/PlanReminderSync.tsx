import { useEffect } from 'react';

import { useRealtimeSubscription, useUpcomingCalendarEvents } from '@/hooks/queries';
import { syncPlanReminders } from '@/lib/plan-reminders';
import { useAuthStore } from '@/stores';

/**
 * Plan reminders: whenever the upcoming plans change (on this phone, or your partner's
 * edits arriving live), this phone's scheduled reminders are brought in line with them.
 */
export function PlanReminderSync() {
  const userId = useAuthStore((s) => s.user?.id);
  const { data: upcoming } = useUpcomingCalendarEvents();
  useRealtimeSubscription('calendar_events');

  useEffect(() => {
    if (!userId || !upcoming) return;
    void syncPlanReminders(upcoming, userId);
  }, [upcoming, userId]);

  return null;
}
