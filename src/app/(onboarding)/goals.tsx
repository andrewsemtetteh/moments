import * as Haptics from '@/lib/haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PeekCharacter } from '@/components/onboarding/Characters';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { GOAL_OPTIONS, goNext, saveOnboardingDraft, useSavedAnswer } from '@/lib/onboarding-v2';
import { useAuthStore } from '@/stores';

const MAX = 3;

/** Step 4: what you want more of (shapes "Your plan" next). */
export default function GoalsScreen() {
  const router = useRouter();
  const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';
  const { colors } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const [picked, setPicked] = useState<string[]>([]);
  useSavedAnswer(userId, preview, 'goals', setPicked);
  // The card just picked: the other characters turn to look at it.
  const [lastPicked, setLastPicked] = useState<number | null>(null);

  const toggle = (key: string) => {
    void Haptics.selectionAsync();
    const i = GOAL_OPTIONS.findIndex((g) => g.key === key);
    if (picked.includes(key)) {
      setPicked(picked.filter((k) => k !== key));
      if (lastPicked === i) setLastPicked(null);
    } else if (picked.length < MAX) {
      setPicked([...picked, key]);
      setLastPicked(i);
    }
  };
  // Two columns: which way (left/right, up/down) card i has to look to see the last pick.
  const lookAtFor = (i: number) =>
    lastPicked === null || lastPicked === i
      ? null
      : { x: Math.sign((lastPicked % 2) - (i % 2)), y: Math.sign(Math.floor(lastPicked / 2) - Math.floor(i / 2)) };

  const next = async () => {
    if (userId && !preview) await saveOnboardingDraft(userId, { goals: picked });
    await goNext(router, 'goals', { userId, preview });
  };

  return (
    <OnboardingStepScreen
      step="goals"
      title="What do you want more of, together?"
      subtitle="Choose up to three. Change them any time."
      centered
      primaryLabel="Build our plan"
      onPrimary={() => void next()}
      primaryDisabled={picked.length === 0}>
      <View style={styles.grid}>
        {GOAL_OPTIONS.map((g, i) => {
          const on = picked.includes(g.key);
          return (
            <Pressable
              key={g.key}
              onPress={() => toggle(g.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: on ? colors.surface : colors.boldBorder ? '#F3F3F3' : colors.surfaceElevated,
                  borderColor: on ? colors.text : 'transparent',
                },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.label, { color: colors.text }]}>{g.label}</Text>
              <View style={[styles.tick, { backgroundColor: colors.text, opacity: on ? 1 : 0 }]}>
                <Icon name="check" size={13} color={colors.background} />
              </View>
              <View style={styles.peek} pointerEvents="none">
                <PeekCharacter color={g.color} size={62} happy={on} seed={i} lookAt={on ? null : lookAtFor(i)} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '48.5%',
    height: 128,
    borderRadius: 20,
    borderWidth: 3,
    padding: 12,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  label: { fontSize: 15, fontWeight: '800', lineHeight: 19, maxWidth: 112 },
  tick: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  peek: { position: 'absolute', right: 6, bottom: -6 },
  pressed: { opacity: 0.85 },
});
