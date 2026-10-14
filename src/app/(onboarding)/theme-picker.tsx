import { useAuth } from '@clerk/expo';
import * as Haptics from '@/lib/haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OnboardingStepScreen } from '@/components/onboarding/OnboardingStepScreen';
import { ThemeHomePreview } from '@/components/onboarding/ThemeHomePreview';
import { Icon } from '@/components/ui/Icon';
import { THEME_META, Themes } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { getFirstName } from '@/lib/avatar-initial';
import { getOnboardingDraft, goNext, previewAnswers } from '@/lib/onboarding-v2';
import { markThemePromptDone } from '@/lib/onboarding-storage';
import { prewarmOnboardingSpace } from '@/lib/onboarding-space';
import { useAuthStore } from '@/stores';

/**
 * Step 6: pick a look. Tapping a theme switches the whole app straight away,
 * and the mini Home here is drawn in it, so what you see is what you get.
 */
export default function ThemePickerScreen() {
  const router = useRouter();
  const preview = useLocalSearchParams<{ preview?: string }>().preview === '1';
  const { colors, theme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);
  // "Good morning, <the name they gave on the first step>".
  const name = getFirstName(preview ? previewAnswers.name : user?.name) ?? getFirstName(user?.name) ?? 'you';
  const label = THEME_META.find((t) => t.key === theme)?.label ?? 'this look';
  // The space name they picked a few steps back titles the preview card.
  const [spaceName, setSpaceName] = useState<string | null>(preview ? (previewAnswers.spaceName ?? null) : null);
  useEffect(() => {
    if (!user?.id || preview) return;
    void getOnboardingDraft(user.id).then((d) => setSpaceName(d.spaceName ?? null));
  }, [user?.id, preview]);

  // Start making their space now, so the invite code is ready two steps later.
  const { getToken } = useAuth();
  useEffect(() => {
    if (!preview) prewarmOnboardingSpace(user?.id, getToken);
  }, [user?.id, preview, getToken]);

  const next = async () => {
    if (user && !preview) await markThemePromptDone(user.id);
    await goNext(router, 'theme-picker', { userId: user?.id, preview });
  };

  return (
    <OnboardingStepScreen
      step="theme-picker"
      title="Pick your look"
      subtitle="The whole app changes with it. Switch any time in Settings."
      primaryLabel={`Use ${label}`}
      onPrimary={() => void next()}>
      {/* The real Home, in the chosen theme. */}
      <ThemeHomePreview name={name} spaceName={spaceName} />

      <View style={styles.swatches}>
        {THEME_META.map((t) => {
          const on = theme === t.key;
          const th = Themes[t.key];
          return (
            <Pressable
              key={t.key}
              onPress={() => {
                void Haptics.selectionAsync();
                setTheme(t.key);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t.label} theme`}
              style={styles.swatchItem}>
              <View
                style={[
                  styles.swatch,
                  { backgroundColor: th.background, borderColor: on ? colors.accent : colors.border, borderWidth: on ? 3 : 1 },
                ]}>
                <LinearGradient colors={th.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.swatchBar} />
                {on ? (
                  <View style={[styles.tick, { backgroundColor: colors.accent }]}>
                    <Icon name="check" size={12} color={colors.onAccent} />
                  </View>
                ) : null}
              </View>
              <Text style={[styles.swatchLabel, { color: colors.text, fontWeight: on ? '900' : '600' }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </OnboardingStepScreen>
  );
}

const styles = StyleSheet.create({
  preview: { borderRadius: 26, padding: 12, gap: 10 },
  hero: { borderRadius: 20, padding: 16, gap: 4 },
  heroSmall: { fontSize: 12, fontWeight: '800', opacity: 0.85 },
  heroTitle: { fontSize: 22, fontWeight: '900', letterSpacing: -0.4 },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 },
  dots: { flexDirection: 'row' },
  dot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2 },
  dotOverlap: { marginLeft: -8 },
  chip: { height: 28, paddingHorizontal: 10, borderRadius: 14, backgroundColor: '#FFFFFF', justifyContent: 'center' },
  chipText: { color: '#1A1008', fontSize: 13, fontWeight: '900' },
  inner: { borderRadius: 16, padding: 12, gap: 2 },
  innerSmall: { fontSize: 12, fontWeight: '800' },
  innerText: { fontSize: 15, fontWeight: '800' },
  buttons: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontSize: 13, fontWeight: '800' },
  swatches: { flexDirection: 'row', gap: 10 },
  swatchItem: { flex: 1, alignItems: 'center', gap: 8 },
  swatch: { alignSelf: 'stretch', height: 70, borderRadius: 16, padding: 8, justifyContent: 'flex-end', overflow: 'hidden' },
  swatchBar: { height: 22, borderRadius: 7 },
  tick: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchLabel: { fontSize: 14 },
});
