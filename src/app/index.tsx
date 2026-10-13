import { useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Wordmark } from '@/components/ui/Wordmark';
import { useTheme } from '@/hooks/useTheme';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by the commented-out restore path below
import { isIntroCompleted } from '@/lib/intro-storage';
import { isAvatarPromptDone, isOnboardingPaywallDone } from '@/lib/onboarding-storage';
import { getOnboardingStep, setOnboardingStep, stepRoute } from '@/lib/onboarding-v2';
import { needsProfileSetup } from '@/lib/profile-setup';
import { useAuthStore, useRelationshipStore } from '@/stores';

const WORDMARK_SIZE = 42;
/** How long this screen actually stays up — a deliberate, visible beat like a
 * normal app's splash, not an instant flash-past. */
const MIN_VISIBLE_MS = 2600;
/** The mark's own closing beat — a quick confident scale-up-and-fade before the
 * route change, the way most polished splash screens exit (Spotify, Instagram,
 * Airbnb) rather than just being flatly swapped for the next screen. */
const EXIT_DURATION_MS = 360;

export default function IndexScreen() {
  const router = useRouter();
  const isLoading = useAuthStore((s) => s.isLoading);
  const session = useAuthStore((s) => s.session);
  const relationship = useRelationshipStore((s) => s.relationship);
  const user = useAuthStore((s) => s.user);
  // Device-level appearance (AsyncStorage), loaded before sign-in too — so the
  // very first screen already matches whatever the person last picked, instead
  // of always flashing black then shifting to their real theme a moment later.
  const { colors } = useTheme();

  const [minVisibleDone, setMinVisibleDone] = useState(false);
  const exitedRef = useRef(false);
  const exitOpacity = useSharedValue(1);
  const exitScale = useSharedValue(1);

  const exitStyle = useAnimatedStyle(() => ({
    opacity: exitOpacity.value,
    transform: [{ scale: exitScale.value }],
  }));

  useEffect(() => {
    // Hand off from the native splash right away — this screen has no motion
    // of its own, so there's nothing to wait for before showing it.
    void SplashScreen.hideAsync();
  }, []);

  /** Plays the mark's exit beat, then swaps the route — so leaving this screen
   * is always this intentional close, never a flat cut mid-animation. */
  const replaceWithExit = useCallback(
    (href: Href) =>
      new Promise<void>((resolve) => {
        // Only the mark itself needs this once — a second in-flight route()
        // call (e.g. a dependency change while still exiting) would otherwise
        // restart it from a partway state.
        if (exitedRef.current) {
          router.replace(href);
          resolve();
          return;
        }
        exitedRef.current = true;
        const finish = () => {
          router.replace(href);
          resolve();
        };
        exitOpacity.value = withTiming(0, { duration: EXIT_DURATION_MS, easing: Easing.in(Easing.cubic) });
        exitScale.value = withTiming(
          1.08,
          { duration: EXIT_DURATION_MS, easing: Easing.in(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(finish)();
          },
        );
      }),
    // exitedRef, exitOpacity, exitScale are stable refs/shared values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router],
  );

  useEffect(() => {
    const timer = setTimeout(() => setMinVisibleDone(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    // Gate navigation on the minimum hold — otherwise a fast auth check can
    // redirect away before this screen ever gets shown at all.
    if (isLoading || !minVisibleDone) return;

    let cancelled = false;

    async function route() {
      if (cancelled) return;

      if (!session) {
        // TEMP: forcing welcome for brand preview. To restore real behavior,
        // delete this line and uncomment the two below it.
        await replaceWithExit('/(auth)/welcome');
        // const hasUsedAuthBefore = await isIntroCompleted();
        // await replaceWithExit(hasUsedAuthBefore ? '/(auth)/login' : '/(auth)/welcome');
        return;
      }
      // Onboarding (lib/onboarding-v2): resume at the saved step, so leaving
      // halfway picks up where they were.
      if (!user) {
        await replaceWithExit('/(onboarding)/about-you');
        return;
      }
      let step = await getOnboardingStep(user.id);
      if (!step) {
        // Accounts from before this flow: done if they finished the old one.
        if (relationship && (await isOnboardingPaywallDone(user.id))) {
          await setOnboardingStep(user.id, 'done');
          step = 'done';
        } else if (!relationship) {
          // A brand-new account, however it signed up (email, Apple, Google,
          // or the login page): always the same flow from the name step. A
          // name/photo from Apple or Google is filled in there, not skipped.
          step = 'about-you';
        } else {
          const avatarDone = await isAvatarPromptDone(user.id);
          step = needsProfileSetup(user, avatarDone) ? 'about-you' : 'theme-picker';
        }
      }
      if (step !== 'done') {
        await replaceWithExit(stepRoute(step));
        return;
      }
      if (!relationship) {
        // Finished before but no space now (left one): make a new one or join.
        await replaceWithExit(stepRoute('invite'));
        return;
      }
      await replaceWithExit('/(tabs)/home');
    }

    route();

    return () => {
      cancelled = true;
    };
  }, [isLoading, minVisibleDone, session, relationship, user, router, replaceWithExit]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        <Animated.View style={exitStyle}>
          <Wordmark size={WORDMARK_SIZE} animated />
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
