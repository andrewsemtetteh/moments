import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';

const AI_USAGE_DATE_KEY = 'moments:ai_usage_date';
const AI_USAGE_COUNT_KEY = 'moments:ai_usage_count';

function todayKey(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export async function getDailyAiUsage(): Promise<number> {
  const [dateEntry, countEntry] = await AsyncStorage.multiGet([AI_USAGE_DATE_KEY, AI_USAGE_COUNT_KEY]);
  if (dateEntry[1] !== todayKey()) return 0;
  return Number.parseInt(countEntry[1] ?? '0', 10) || 0;
}

export async function incrementDailyAiUsage(): Promise<number> {
  const today = todayKey();
  const storedDate = await AsyncStorage.getItem(AI_USAGE_DATE_KEY);
  let count = 0;
  if (storedDate === today) {
    count = Number.parseInt((await AsyncStorage.getItem(AI_USAGE_COUNT_KEY)) ?? '0', 10) || 0;
  }
  count += 1;
  await AsyncStorage.multiSet([
    [AI_USAGE_DATE_KEY, today],
    [AI_USAGE_COUNT_KEY, String(count)],
  ]);
  return count;
}
