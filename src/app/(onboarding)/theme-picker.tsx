import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { OnboardingChrome } from '@/components/onboarding/OnboardingChrome';
import { Icon } from '@/components/ui/Icon';
import { PrimaryButton } from '@/components/ui/primitives';
import { Spacing, THEME_META } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { markThemePromptDone } from '@/lib/onboarding-storage';
import { useAuthStore } from '@/stores';

export default function ThemePickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, theme, setTheme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const params = useLocalSearchParams<{ next?: string }>();

  const selectTheme = (key: typeof theme) => {
    void Haptics.selectionAsync();
    setTheme(key);
  };

  const goNext = async () => {
    if (user) await markThemePromptDone(user.id);
    router.replace({
      pathname: '/(onboarding)/widget-prompt',
      params: { next: params.next === 'welcome' ? 'welcome' : 'home' },
    });
  };

  return (
    <OnboardingChrome stepId="theme-picker">
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.lg, paddingHorizontal: Spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>Pick your look</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Tap a style to preview it. You can change this anytime in Settings.
          </Text>

          <View style={styles.grid}>
            {THEME_META.map((t) => {
              const active = theme === t.key;
              return (
                <Pressable
                  key={t.key}
                  onPress={() => selectTheme(t.key)}
                  style={styles.cell}
                  accessibilityRole="radio"
                  accessibilityLabel={`${t.label} theme`}
                  accessibilityState={{ selected: active }}>
                  <View
                    style={[
                      styles.swatch,
                      {
                        backgroundColor: t.swatch,
                        borderColor: active ? colors.accent : colors.border,
                        borderWidth: active ? 3 : 1,
                      },
                    ]}>
                    {active ? <Icon name="check" size={26} color={colors.accent} /> : null}
                  </View>
                  <Text
                    style={[styles.label, { color: active ? colors.text : colors.textSecondary }]}>
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <PrimaryButton label="Continue" onPress={goNext} style={styles.btn} />
        </View>
      </ScrollView>
    </OnboardingChrome>
  );
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 400 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, textAlign: 'center', lineHeight: 22, marginTop: 10, maxWidth: 300 },
  grid: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginTop: 32, width: '100%' },
  cell: { alignItems: 'center', gap: 10, width: 88 },
  swatch: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  btn: { width: '100%', marginTop: 36 },
});
