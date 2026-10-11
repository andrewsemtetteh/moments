import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OnboardingChrome } from '@/components/onboarding/OnboardingChrome';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Card, PrimaryButton } from '@/components/ui/primitives';
import { Radius, Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { markWidgetPromptDone, saveWidgetPreferences } from '@/lib/onboarding-storage';
import { useAuthStore } from '@/stores';

type NextRoute = 'home' | 'welcome';

const WIDGET_OPTIONS: { key: string; icon: IconName; title: string; body: string }[] = [
  { key: 'streak', icon: 'fire', title: 'Streak', body: 'See your streak at a glance' },
  { key: 'mood', icon: 'heart', title: 'Mood', body: 'Check in on how you both feel' },
  { key: 'countdown', icon: 'calendar', title: 'Countdown', body: 'Track your next anniversary or date' },
];

export default function WidgetPromptScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const params = useLocalSearchParams<{ next?: string }>();
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const nextRoute: NextRoute = params.next === 'welcome' ? 'welcome' : 'home';

  const finish = async () => {
    if (user) await markWidgetPromptDone(user.id);

    router.replace({
      pathname: '/(onboarding)/notification-prompt',
      params: { next: nextRoute },
    });
  };

  const toggle = (key: string) => {
    void Haptics.selectionAsync();
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  const handleContinue = async () => {
    setLoading(true);
    try {
      await saveWidgetPreferences(selected);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await finish();
    } finally {
      setLoading(false);
    }
  };

  const skip = async () => {
    void Haptics.selectionAsync();
    await finish();
  };

  return (
    <OnboardingChrome stepId="widget-prompt">
      <View
        style={[
          styles.safe,
          { paddingBottom: insets.bottom + Spacing.lg },
        ]}>
        <View style={styles.body}>
          <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.hero}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: colors.accentSoft, borderColor: colors.border },
              ]}>
              <Icon name="image" size={32} color={colors.accent} filled />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).duration(400).springify()} style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }]}>Add a widget</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Pick what you&apos;d like on your Home Screen. We&apos;ll walk you through adding it.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(400).springify()} style={styles.optionsWrap}>
            <Card style={styles.optionsCard}>
              {WIDGET_OPTIONS.map((item, index) => {
                const active = selected.includes(item.key);
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => toggle(item.key)}
                    style={[
                      styles.optionRow,
                      index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
                    ]}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}>
                    <View style={[styles.optionIcon, { backgroundColor: colors.accentSoft }]}>
                      <Icon name={item.icon} size={18} color={colors.accent} filled={item.icon === 'fire'} />
                    </View>
                    <View style={styles.optionCopy}>
                      <Text style={[styles.optionTitle, { color: colors.text }]}>{item.title}</Text>
                      <Text style={[styles.optionBody, { color: colors.textSecondary }]}>{item.body}</Text>
                    </View>
                    <View
                      style={[
                        styles.checkbox,
                        {
                          backgroundColor: active ? colors.accent : colors.surfaceElevated,
                          borderColor: active ? colors.accent : colors.border,
                        },
                      ]}>
                      {active ? <Icon name="check" size={14} color={colors.onAccent} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </Card>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(180).duration(400).springify()} style={styles.actions}>
          <PrimaryButton
            label={loading ? 'Saving…' : 'Continue'}
            onPress={handleContinue}
            loading={loading}
            style={styles.btn}
          />
          <Pressable
            onPress={skip}
            disabled={loading}
            hitSlop={8}
            style={({ pressed }) => [styles.skipWrap, pressed && { opacity: 0.65 }]}>
            <Text style={[styles.skip, { color: colors.textSecondary }]}>Remind me later</Text>
          </Pressable>
        </Animated.View>
      </View>
    </OnboardingChrome>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, paddingHorizontal: Spacing.lg },
  body: { flex: 1, justifyContent: 'center' },
  hero: { alignItems: 'center', marginBottom: 24 },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { alignItems: 'center', gap: 10, marginBottom: 28 },
  title: {
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    maxWidth: 320,
  },
  optionsWrap: { width: '100%' },
  optionsCard: { width: '100%' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
  },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: { flex: 1, gap: 3 },
  optionTitle: { fontSize: 16, fontWeight: '700' },
  optionBody: { fontSize: 14, lineHeight: 20 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { gap: 14, paddingTop: 8 },
  btn: { borderRadius: Radius.pill },
  skipWrap: { alignItems: 'center', paddingVertical: 6 },
  skip: { fontSize: 15, fontWeight: '600' },
});
