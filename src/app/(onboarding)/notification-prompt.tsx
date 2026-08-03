import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/ui/Icon';
import { Card, PrimaryButton } from '@/components/ui/primitives';
import { Radius, Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';
import { markNotificationPromptDone } from '@/lib/onboarding-storage';
import { requestPushNotificationPermission } from '@/lib/push-notifications';
import { useAuthStore } from '@/stores';

type NextRoute = 'home' | 'welcome';

const NOTIFICATION_BENEFITS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'camera',
    title: 'New moments',
    body: 'Know when your partner shares a photo or message',
  },
  {
    icon: 'fire',
    title: 'Streak alerts',
    body: 'Get a nudge 3 hours before, then a last-chance alert 1 hour before midnight',
  },
];

export default function NotificationPromptScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const params = useLocalSearchParams<{ next?: string }>();
  const [loading, setLoading] = useState(false);

  const nextRoute: NextRoute = params.next === 'welcome' ? 'welcome' : 'home';

  const finish = async () => {
    if (user) await markNotificationPromptDone(user.id);

    router.replace({
      pathname: '/pro',
      params: { from: 'onboarding', next: nextRoute },
    });
  };

  const enableNotifications = async () => {
    setLoading(true);
    try {
      await requestPushNotificationPermission();
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
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <SafeAreaView
        style={[
          styles.safe,
          {
            paddingTop: Spacing.sm,
            paddingBottom: insets.bottom + Spacing.lg,
          },
        ]}>
        <View style={styles.body}>
          <Animated.View entering={FadeInDown.duration(400).springify()} style={styles.hero}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: colors.accentSoft,
                  borderColor: colors.border,
                },
              ]}>
              <Icon name="bell" size={32} color={colors.accent} filled />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(60).duration(400).springify()} style={styles.copy}>
            <Text style={[styles.title, { color: colors.text }]}>Never miss a moment</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              You&apos;ll receive notifications from your partner.
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(120).duration(400).springify()} style={styles.benefitsWrap}>
            <Card style={styles.benefitsCard}>
              {NOTIFICATION_BENEFITS.map((item, index) => (
                <View
                  key={item.title}
                  style={[
                    styles.benefitRow,
                    index > 0 && {
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: colors.border,
                    },
                  ]}>
                  <View style={[styles.benefitIcon, { backgroundColor: colors.accentSoft }]}>
                    <Icon name={item.icon} size={18} color={colors.accent} filled={item.icon === 'fire'} />
                  </View>
                  <View style={styles.benefitCopy}>
                    <Text style={[styles.benefitTitle, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[styles.benefitBody, { color: colors.textSecondary }]}>{item.body}</Text>
                  </View>
                </View>
              ))}
            </Card>

            <Text style={[styles.settingsHint, { color: colors.textTertiary }]}>
              You can change this anytime in your device settings.
            </Text>
          </Animated.View>
        </View>

        <Animated.View entering={FadeInDown.delay(180).duration(400).springify()} style={styles.actions}>
          <PrimaryButton
            label={loading ? 'Enabling…' : 'Turn on notifications'}
            onPress={enableNotifications}
            loading={loading}
            style={styles.btn}
          />
          <Pressable
            onPress={skip}
            disabled={loading}
            hitSlop={8}
            style={({ pressed }) => [styles.skipWrap, pressed && { opacity: 0.65 }]}>
            <Text style={[styles.skip, { color: colors.textSecondary }]}>Not now</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1, paddingHorizontal: 24 },
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
  benefitsWrap: { width: '100%', gap: 12 },
  benefitsCard: { width: '100%' },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 14,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitCopy: { flex: 1, gap: 3 },
  benefitTitle: { fontSize: 16, fontWeight: '700' },
  benefitBody: { fontSize: 14, lineHeight: 20 },
  settingsHint: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  actions: { gap: 14, paddingTop: 8 },
  btn: { borderRadius: Radius.pill },
  skipWrap: { alignItems: 'center', paddingVertical: 6 },
  skip: { fontSize: 15, fontWeight: '600' },
});
