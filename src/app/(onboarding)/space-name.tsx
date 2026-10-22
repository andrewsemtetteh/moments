import * as Haptics from '@/lib/haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TextInput } from '@/components/ui/ThemedTextInput';

import { CoupleCharacters } from '@/components/onboarding/Characters';
import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { useTheme } from '@/hooks/useTheme';
import { goNext, previewAnswers, saveOnboardingDraft, useSavedAnswer } from '@/lib/onboarding-v2';
import { sanitizeNameInput } from '@/lib/sanitize-input';
import { useAuthStore } from '@/stores';

const SUGGESTIONS = ['Our little world', 'Us', 'Home base', 'Team us', 'Our corner', 'Two of us'];

/**
 * Step 4: name your shared space. It's the title on Home for both of you,
 * so pick something that feels like yours. Rename any time in Settings.
 */
export default function SpaceNameScreen() {
  const router = useRouter();
  const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';
  const { colors } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const [name, setName] = useState(preview ? (previewAnswers.spaceName ?? '') : '');
  useSavedAnswer(userId, preview, 'spaceName', setName);

  const next = async (value: string | null) => {
    if (preview) previewAnswers.spaceName = value?.trim() || null;
    else if (userId) await saveOnboardingDraft(userId, { spaceName: value?.trim() || null });
    await goNext(router, 'space-name', { userId, preview });
  };

  return (
    <OnboardingStepScreen
      step="space-name"
      art={<CoupleCharacters width={170} />}
      title="Name your space"
      subtitle="It’s the title on Home for both of you. Something that feels like the two of you."
      primaryLabel="Continue"
      onPrimary={() => void next(name)}
      primaryDisabled={!name.trim()}
      secondaryLabel="Decide later"
      onSecondary={() => void next(null)}>
      <TextInput
        value={name}
        onChangeText={(t) => setName(sanitizeNameInput(t).slice(0, 32))}
        placeholder="e.g. Our little world"
        placeholderTextColor={colors.textTertiary}
        autoCapitalize="words"
        returnKeyType="done"
        // Done on the keyboard carries on, like Continue.
        onSubmitEditing={() => {
          if (name.trim()) void next(name);
        }}
        maxLength={32}
        style={[styles.input, { color: colors.text, borderColor: colors.text, backgroundColor: colors.surface }]}
      />
      <Text style={[styles.label, { color: colors.textSecondary }]}>Or pick one</Text>
      <View style={styles.chips}>
        {SUGGESTIONS.map((s) => {
          const on = name === s;
          return (
            <Pressable
              key={s}
              onPress={() => {
                void Haptics.selectionAsync();
                setName(s);
              }}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.chip,
                { borderColor: colors.text, backgroundColor: on ? colors.text : colors.surface },
                pressed && styles.pressed,
              ]}>
              <Text style={[styles.chipText, { color: on ? colors.background : colors.text }]}>{s}</Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  input: { height: 58, borderRadius: 16, borderWidth: 2, paddingHorizontal: 16, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '800', textAlign: 'center', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: { height: 40, paddingHorizontal: 14, borderRadius: 20, borderWidth: 2, justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.8 },
});
