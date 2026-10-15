import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used by the commented-out restore path below
import { isIntroCompleted } from '@/lib/intro-storage';
import { isAvatarPromptDone, isOnboardingPaywallDone } from '@/lib/onboarding-storage';
import { getOnboardingStep, setOnboardingStep, stepRoute } from '@/lib/onboarding-v2';
import { needsProfileSetup } from '@/lib/profile-setup';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';

/** The heart alone, no name: same as the native splash it follows. */
const LOGO_SIZE = 180;
const SPLASH_LOGO = require('../../assets/images/splash-logo-rounded.png');
/** The launch screen: the logo, still (no animation), for 5 seconds from when
 * it's actually on screen, then straight on to the next screen (no fade). */
const MIN_VISIBLE_MS = 5000;

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
  // Keep the native splash up until the saved theme is known, so the logo and
  // "moments" are drawn in the right colours from the first frame.
  const themeReady = useUIStore((s) => s.themeReady);

  const [minVisibleDone, setMinVisibleDone] = useState(false);
  // When this screen is actually on screen: after the native splash has gone,
  // a frame has painted, and app start-up work (sign-in check, fonts, data)
  // has settled. The hold below counts from here, not from when the code
  // loaded; otherwise a slow start (Expo Go, dev mode) used up the whole hold
  // before anyone saw it, and it flashed past.
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!themeReady) return;
    let alive = true;
    void SplashScreen.hideAsync()
      .catch(() => undefined)
      .finally(() => {
        // Two frames: the first paints this screen, the second confirms it's up.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            if (alive) setVisible(true);
          }),
        );
      });
    return () => {
      alive = false;
    };
  }, [themeReady]);

  /** Straight on to the next screen: no exit animation. */
  const replaceWithExit = useCallback((href: Href) => {
    router.replace(href);
    return Promise.resolve();
  }, [router]);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setMinVisibleDone(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [visible]);

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
      {themeReady ? (
        <View style={styles.center}>
          {/* Same rounded logo, same size as the native splash, so the hand-off doesn't jump. */}
          <Image source={SPLASH_LOGO} style={styles.logo} contentFit="contain" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
});
