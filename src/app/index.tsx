import { useRouter, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/ui/Logo';
import { useTheme } from '@/hooks/useTheme';
import { isIntroCompleted } from '@/lib/intro-storage';
import { isOnboardingPaywallDone } from '@/lib/onboarding-storage';
import { getOnboardingStep, setOnboardingStep, stepRoute } from '@/lib/onboarding-v2';
import { needsProfileName } from '@/lib/profile-setup';
import { useAuthStore, useRelationshipStore, useUIStore } from '@/stores';

/** The heart alone, no name: same as the native splash it follows. */
/** The plain mark; same size as the native splash (imageWidth in app.json). */
const LOGO_SIZE = 160;
/** The launch screen: the logo, still (no animation), for 5 seconds from when
 * it's actually on screen, then straight on to the next screen (no fade). */
const MIN_VISIBLE_MS = 5000;
/**
 * The hold is for the cold start only. Coming back here in the same run (an invite or
 * referral link routes through this screen) goes straight on, no 5-second wait.
 */
let shownThisRun = false;

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
  // The theme's own colour: violet on Violet, black on Dark, cream on Cream, white on Default.
  const splash = colors.splash ?? colors.background;

  const [minVisibleDone, setMinVisibleDone] = useState(shownThisRun);
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
    if (!visible || shownThisRun) return;
    const timer = setTimeout(() => {
      shownThisRun = true;
      setMinVisibleDone(true);
    }, MIN_VISIBLE_MS);
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
        // First time on this phone: the welcome slides. Someone who's signed in here
        // before (and signed out): straight to Log in.
        const hasUsedAuthBefore = await isIntroCompleted();
        await replaceWithExit(hasUsedAuthBefore ? '/(auth)/login' : '/(auth)/welcome');
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
          // An account that's already set up and paired, signing in on a new phone or
          // after reinstalling (this phone has no saved step): straight into the app.
          // Only a missing name sends it back to the first step (the photo prompt's
          // "asked already" flag lives on the old phone, and a photo is optional).
          step = needsProfileName(user) ? 'about-you' : 'done';
          if (step === 'done') await setOnboardingStep(user.id, 'done');
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
    <View style={[styles.screen, { backgroundColor: splash }]}>
      <StatusBar style={isDarkColor(splash) ? 'light' : 'dark'} />
      {themeReady ? (
        <View style={styles.center}>
          {/* The plain logo on the theme's own background, same size as the native splash, so the hand-off doesn't jump. */}
          <LogoMark size={LOGO_SIZE} color={colors.splashMark} />
        </View>
      ) : null}
    </View>
  );
}

/** Whether a #rrggbb colour needs light status-bar icons. */
function isDarkColor(hex: string) {
  const h = hex.replace('#', '');
  if (h.length !== 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  logo: { width: LOGO_SIZE, height: LOGO_SIZE },
});
