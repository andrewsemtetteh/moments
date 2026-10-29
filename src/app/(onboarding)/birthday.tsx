import { useAuth } from '@clerk/expo';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { StickerCake } from '@/components/home/StickerCake';
import { AnniversaryWheelPicker } from '@/components/onboarding/AnniversaryWheelPicker';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { paperEdge } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { askChoice } from '@/components/ui/ChoiceSheet';
import {
  birthdayDayLabel,
  daysUntilBirthday,
  isOldEnough,
  latestBirthYear,
  MIN_AGE,
  nextBirthday,
  parseBirthday,
} from '@/lib/birthday';
import { updateMyProfile } from '@/lib/moments-api';
import { goNext } from '@/lib/onboarding-v2';
import { useAuthStore } from '@/stores';

/** Where the wheels start. Someone born on it can keep it: Continue asks "Is it…?" first. */
const START = '2000-01-01';

/**
 * After your plan: your birthday (optional). Your partner gets a
 * heads-up the day before; on the day, you both get the birthday page.
 */
export default function BirthdayScreen() {
  const router = useRouter();
  const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';
  const { colors } = useTheme();
  const { getToken } = useAuth();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [date, setDate] = useState(user?.birthday ?? START);
  // Turned the wheels (or a birthday was already saved). If not, Continue checks the date with them.
  const [picked, setPicked] = useState(!!user?.birthday);
  const [busy, setBusy] = useState(false);
  const choose = useCallback((value: string) => {
    setDate(value);
    setPicked(true);
  }, []);

  const days = picked ? daysUntilBirthday(date) : null;
  const next = picked ? nextBirthday(date) : null;

  /** Continue: under 16 can't go on; the untouched start date is checked ("Is it 1 January 2000?"). */
  const confirm = () => {
    if (!isOldEnough(date)) {
      askChoice({
        title: `Moments is for ${MIN_AGE} and over`,
        message: 'Check your birthday on the wheels. If it’s right, Moments isn’t available to you yet.',
        actions: [],
        cancelLabel: 'Okay',
      });
      return;
    }
    if (picked) {
      void save(date);
      return;
    }
    const born = parseBirthday(date);
    askChoice({
      title: `Is your birthday ${born ? format(born, 'd MMMM yyyy') : 'this date'}?`,
      actions: [{ label: 'Yes, that’s it', onPress: () => void save(date) }],
      cancelLabel: 'Let me pick',
    });
  };

  const save = async (birthday: string | null) => {
    if (preview || !user || !birthday || birthday === user.birthday) {
      await goNext(router, 'birthday', { userId: user?.id, preview });
      return;
    }
    setBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Not signed in');
      setUser(await updateMyProfile(token, { birthday }));
      await goNext(router, 'birthday', { userId: user.id });
    } catch (e) {
      Alert.alert('Couldn’t save', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingStepScreen
      step="birthday"
      title="When’s your birthday?"
      subtitle="So your partner never misses it."
      primaryLabel="Continue"
      onPrimary={confirm}
      primaryDisabled={busy}
      secondaryLabel="Skip for now"
      onSecondary={() => void save(null)}
      scroll={false}>
      <AnniversaryWheelPicker value={date} onChange={choose} surfaceColor={colors.background} minYear={1920} maxYear={latestBirthYear()} />
      <View style={[styles.note, { backgroundColor: colors.surfaceElevated }, paperEdge(colors)]}>
        <StickerCake size={56} />
        <Text style={[styles.noteText, { color: colors.text }]}>
          {days == null || !next
            ? 'Scroll to your birthday.'
            : days === 0
              ? 'It’s today? Happy birthday!'
              : days === 1
                ? 'Tomorrow! We’ll make sure they know.'
                : `${days.toLocaleString()} days to go: ${birthdayDayLabel(next)}.`}
        </Text>
      </View>
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  note: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 20, padding: 10, paddingRight: 16 },
  noteText: { flex: 1, fontSize: 16, fontWeight: '800', lineHeight: 21 },
});
