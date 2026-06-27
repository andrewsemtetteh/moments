import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { CoupleOrbitArt } from '@/components/onboarding/CoupleOrbitArt';
import { colorWithAlpha } from '@/components/ui/primitives';
import { Radius, Spacing } from '@/constants/design-system';
import { useTheme } from '@/hooks/useTheme';

export default function AuthWelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const handleGetStarted = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(auth)/get-started');
  };

  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const orbitSize = Math.min(screenWidth - 24, screenHeight * 0.54);
  const bottomInset = Math.max(insets.bottom, Spacing.lg);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <Animated.View
          entering={FadeIn.duration(400)}
          style={[styles.content, { paddingBottom: bottomInset + Spacing.xxl }]}>
          <View style={styles.orbitWrap}>
            <CoupleOrbitArt size={orbitSize} />
          </View>

          <View style={styles.copy}>
            <Text style={styles.wordmark}>moments</Text>

            <Text style={styles.headline}>Your shared life</Text>

            <View style={styles.accentLineWrap}>
              <View style={styles.accentLineBg} pointerEvents="none" />
              <Text style={[styles.accentLine, { color: colors.accent }]}>Starts here</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <Pressable
              onPress={handleGetStarted}
              style={({ pressed }) => [styles.primaryCta, { opacity: pressed ? 0.9 : 1 }]}>
              <Text style={styles.primaryCtaText}>Get started</Text>
            </Pressable>
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  safe: {
    flex: 1,
    paddingHorizontal: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  orbitWrap: {
    marginTop: -24,
    marginBottom: Spacing.xxl + Spacing.lg,
  },
  copy: {
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  wordmark: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'lowercase',
    marginBottom: 4,
    color: colorWithAlpha('#FFFFFF', 0.62),
  },
  headline: {
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1.1,
    textAlign: 'center',
    color: '#FFFFFF',
  },
  accentLineWrap: {
    marginTop: 2,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  accentLineBg: {
    ...StyleSheet.absoluteFill,
    borderRadius: 8,
  },
  accentLine: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.2,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  actions: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  primaryCta: {
    minHeight: 54,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
  },
  primaryCtaText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.2,
    color: '#000000',
  },
});
