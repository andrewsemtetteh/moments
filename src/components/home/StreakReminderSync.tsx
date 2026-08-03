import { useEffect } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { useStreak } from '@/hooks/queries';
import { cancelStreakReminders, syncStreakReminders } from '@/lib/streak-reminders';
import { useAuthStore, useRelationshipStore } from '@/stores';

/** Schedules 3h + 1h local streak warnings when this user still needs to check in. */
export function StreakReminderSync() {
  const session = useAuthStore((s) => s.session);
  const relationship = useRelationshipStore((s) => s.relationship);
  const { data: streak } = useStreak();

  useEffect(() => {
    if (Platform.OS === 'web' || !session || !relationship?.id) {
      void cancelStreakReminders();
      return;
    }
    if (!streak) return;

    void syncStreakReminders(streak);

    const onAppState = (state: AppStateStatus) => {
      if (state === 'active') void syncStreakReminders(streak);
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      sub.remove();
    };
  }, [session, relationship?.id, streak]);

  return null;
}
