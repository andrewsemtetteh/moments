import { useDailyChallenge, useMoods, useMoments, useStreak } from '@/hooks/queries';

/** Warms home tab caches app-wide so streak, mood, and related sections render instantly. */
export function HomeSync() {
  useStreak();
  useMoods();
  useDailyChallenge();
  useMoments();
  return null;
}
