import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PeekCharacter } from '@/components/onboarding/Characters';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { useTheme } from '@/hooks/useTheme';
import { goNext, saveOnboardingDraft } from '@/lib/onboarding-v2';
import { RELATIONSHIP_TYPE_OPTIONS } from '@/lib/relationship-type';
import { useAuthStore } from '@/stores';
import type { RelationshipType } from '@/types/database';

const COLORS = ['#8C7CF0', '#7FD3A8', '#FF8A65', '#FFD25E', '#9AD0F5', '#FF9EB0'];

/** Step 3: what life looks like for you two (tunes reminders and copy). */
export default function RelationshipKindScreen() {
  const router = useRouter();
  const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';
  const { colors } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const [picked, setPicked] = useState<RelationshipType | null>(null);
  const pickedIndex = RELATIONSHIP_TYPE_OPTIONS.findIndex((o) => o.value === picked);

  const next = async (value: RelationshipType | null) => {
    if (userId && !preview) await saveOnboardingDraft(userId, { relationshipType: value });
    await goNext(router, 'relationship-kind', { userId, preview });
  };

  return (
    <OnboardingStepScreen
      step="relationship-kind"
      title="What’s life like for you two right now?"
      primaryLabel="Continue"
      onPrimary={() => void next(picked)}
      primaryDisabled={!picked}
      secondaryLabel="Skip for now"
      onSecondary={() => void next(null)}>
      {RELATIONSHIP_TYPE_OPTIONS.map((o, i) => {
        const on = picked === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              void Haptics.selectionAsync();
              setPicked(o.value);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: colors.boldBorder ? '#F3F3F3' : colors.surface,
                borderColor: on ? colors.text : 'transparent',
              },
              pressed && styles.pressed,
            ]}>
            <Text style={[styles.label, { color: colors.text }]}>{o.label}</Text>
            <View style={styles.peek}>
              <PeekCharacter
                color={COLORS[i % COLORS.length]}
                size={66}
                happy={on}
                seed={i}
                lookAt={pickedIndex >= 0 && !on ? { x: 0, y: Math.sign(pickedIndex - i) } : null}
              />
            </View>
          </Pressable>
        );
      })}
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  option: {
    height: 66,
    borderRadius: 18,
    borderWidth: 3,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 18,
    overflow: 'hidden',
  },
  label: { flex: 1, fontSize: 17, fontWeight: '800' },
  peek: { alignSelf: 'flex-end', marginBottom: -6, marginRight: 4 },
  pressed: { opacity: 0.85 },
});
