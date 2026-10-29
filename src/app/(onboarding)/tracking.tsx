import { useLocalSearchParams, useRouter } from 'expo-router';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ShieldCharacter } from '@/components/onboarding/Characters';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { goNext } from '@/lib/onboarding-v2';
import { useAuthStore } from '@/stores';
import { insetCardStyle, separatorColor } from '@/components/ui/primitives';

/**
 * Step 10: App Tracking Transparency, asked late (never on first launch),
 * with an honest reason and no reward. "Not now" never shows iPhone's prompt,
 * so it can still be asked later.
 */
export default function TrackingScreen() {
  const router = useRouter();
  const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';
  const { colors } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const [busy, setBusy] = useState(false);

  const next = async (ask: boolean) => {
    setBusy(true);
    try {
      if (ask && !preview) await requestTrackingPermissionsAsync().catch(() => undefined);
      await goNext(router, 'tracking', { userId, preview });
    } finally {
      setBusy(false);
    }
  };

  return (
    <OnboardingStepScreen
      step="tracking"
      art={<ShieldCharacter size={120} />}
      centered
      title="Help us reach more couples like you"
      subtitle="If you allow it, we can see which ads brought you here, so we spend less on the ones that don’t work. It never touches your moments, messages or photos."
      primaryLabel="Continue"
      onPrimary={() => void next(true)}
      busy={busy}
      secondaryLabel="Not now"
      onSecondary={() => void next(false)}>
      <View style={[styles.list, insetCardStyle(colors, 'page')]}>
        {['Your chat and moments stay private either way', 'Change your mind any time in Settings'].map((t, i) => (
          <View key={t} style={[styles.row, i === 0 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: separatorColor(colors) }]}>
            <Icon name="check" size={18} color={colors.text} />
            <Text style={[styles.text, { color: colors.text }]}>{t}</Text>
          </View>
        ))}
      </View>
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  list: { borderWidth: 2, borderRadius: 20, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingHorizontal: 16 },
  text: { flex: 1, fontSize: 14, fontWeight: '700' },
});
