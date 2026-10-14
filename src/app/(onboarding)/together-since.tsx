import { differenceInCalendarDays, parseISO } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AnniversaryWheelPicker } from '@/components/onboarding/AnniversaryWheelPicker';
import { CalendarCharacter } from '@/components/onboarding/Characters';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { useTheme } from '@/hooks/useTheme';
import { formatAnniversaryForDb } from '@/lib/anniversary';
import { goNext, saveOnboardingDraft, useSavedAnswer } from '@/lib/onboarding-v2';
import { useAuthStore } from '@/stores';

/** Step 2: when you got together (countdowns and milestones run off this). */
export default function TogetherSinceScreen() {
  const router = useRouter();
  const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';
  const { colors } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const [date, setDate] = useState(formatAnniversaryForDb(new Date()));
  useSavedAnswer(userId, preview, 'anniversaryDate', setDate);
  const days = Math.max(0, differenceInCalendarDays(new Date(), parseISO(date)));

  const next = async (value: string | null) => {
    if (userId && !preview) await saveOnboardingDraft(userId, { anniversaryDate: value });
    await goNext(router, 'together-since', { userId, preview });
  };

  return (
    <OnboardingStepScreen
      step="together-since"
      title="When did you two get together?"
      subtitle="For your anniversary countdown and the milestones we’ll celebrate with you."
      primaryLabel="Continue"
      onPrimary={() => void next(date)}
      secondaryLabel="Skip for now"
      onSecondary={() => void next(null)}
      scroll={false}>
      <AnniversaryWheelPicker value={date} onChange={setDate} surfaceColor={colors.surface} />
      <View style={[styles.note, { backgroundColor: colors.surfaceElevated }]}>
        <CalendarCharacter size={64} />
        <Text style={[styles.noteText, { color: colors.text }]}>
          {days > 0 ? `That’s ${days.toLocaleString()} days together. Nice.` : 'Day one. How exciting.'}
        </Text>
      </View>
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 8, paddingRight: 16 },
  noteText: { flex: 1, fontSize: 16, fontWeight: '800', lineHeight: 21 },
});
