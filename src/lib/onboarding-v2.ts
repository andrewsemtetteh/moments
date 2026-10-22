import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Href, useRouter } from 'expo-router';

import type { RelationshipType } from '@/types/database';

/**
 * The onboarding flow, in order. Each screen calls `goNext` when it's done;
 * the step reached is saved per user, so quitting halfway resumes at the same
 * screen next launch (see app/index.tsx). The paywall is the last step; the
 * tour runs on Home right after it.
 *
 * Preview mode (dev "walk through onboarding"): the same screens, nothing
 * saved or sent, `?preview=1` carried from screen to screen.
 */
export const ONBOARDING_STEPS = [
  'about-you',
  'together-since',
  'relationship-kind',
  'space-name',
  'goals',
  'your-plan',
  // After they've seen their plan (invested by then), and before the lighter steps.
  'birthday',
  'theme-picker',
  'widget-prompt',
  'invite',
  'notification-prompt',
  'tracking',
  'paywall',
] as const;

export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

const STEP_KEY = (userId: string) => `moments_onboarding_v2_step:${userId}`;
const DRAFT_KEY = (userId: string) => `moments_onboarding_v2_draft:${userId}`;
const TOUR_KEY = (userId: string) => `moments_tour_pending:${userId}`;

export type OnboardingDraft = {
  anniversaryDate?: string | null;
  relationshipType?: RelationshipType | null;
  goals?: string[];
  /** What they call their shared space ("Our little world"). */
  spaceName?: string | null;
};

export const GOAL_OPTIONS: { key: string; label: string; color: string }[] = [
  { key: 'talk', label: 'Talk every day', color: '#8C7CF0' },
  { key: 'closer', label: 'Feel closer apart', color: '#FF8A65' },
  { key: 'dates', label: 'More date nights', color: '#FFD25E' },
  { key: 'play', label: 'Play together', color: '#7FD3A8' },
  { key: 'remember', label: 'Remember our moments', color: '#9AD0F5' },
  { key: 'deeper', label: 'Deeper conversations', color: '#FF9EB0' },
];

/**
 * DEV "design pass": walk sign-up and onboarding with no real account. Set
 * from the welcome screen; the auth screens and every step then just move on
 * (nothing is created, saved or sent). Stripped from release builds (__DEV__).
 */
export const designPass = { on: false };

/**
 * What was typed during a walkthrough (?preview=1), held in memory only, so
 * later steps still show your own name and space name without saving.
 */
export const previewAnswers: { name?: string; spaceName?: string | null } = {};

export function stepRoute(step: OnboardingStep, preview = false): Href {
  const params = preview ? { preview: '1' } : undefined;
  if (step === 'paywall') return { pathname: '/pro', params: { from: 'onboarding', next: 'home', ...(params ?? {}) } };
  return { pathname: `/(onboarding)/${step}` as never, params } as Href;
}

/**
 * The steps this phone actually shows. Android has no Moments widgets and no
 * App Tracking prompt, so those two steps would only be dead ends there.
 */
const FLOW_STEPS: readonly OnboardingStep[] =
  Platform.OS === 'android'
    ? ONBOARDING_STEPS.filter((s) => s !== 'widget-prompt' && s !== 'tracking')
    : ONBOARDING_STEPS;

/** Where `step` sits in this phone's flow (a skipped step counts as the one before it). */
export function stepIndex(step: OnboardingStep) {
  const i = FLOW_STEPS.indexOf(step);
  if (i >= 0) return i;
  const before = ONBOARDING_STEPS.slice(0, ONBOARDING_STEPS.indexOf(step)).filter((s) => FLOW_STEPS.includes(s));
  return before.length - 0.5;
}

/** The step after / before `step` on this phone, if any. */
export function nextStep(step: OnboardingStep): OnboardingStep | undefined {
  return FLOW_STEPS[Math.floor(stepIndex(step)) + 1];
}
export function prevStep(step: OnboardingStep): OnboardingStep | undefined {
  return FLOW_STEPS[Math.ceil(stepIndex(step)) - 1];
}

/** 0…1 for the progress bar. */
export function stepProgress(step: OnboardingStep) {
  return (Math.max(0, stepIndex(step)) + 1) / FLOW_STEPS.length;
}

export async function getOnboardingStep(userId: string): Promise<OnboardingStep | 'done' | null> {
  const v = await AsyncStorage.getItem(STEP_KEY(userId));
  if (v === 'done') return 'done';
  return (ONBOARDING_STEPS as readonly string[]).includes(v ?? '') ? (v as OnboardingStep) : null;
}

export async function setOnboardingStep(userId: string, step: OnboardingStep | 'done') {
  await AsyncStorage.setItem(STEP_KEY(userId), step);
}

export async function getOnboardingDraft(userId: string): Promise<OnboardingDraft> {
  try {
    const raw = await AsyncStorage.getItem(DRAFT_KEY(userId));
    return raw ? (JSON.parse(raw) as OnboardingDraft) : {};
  } catch {
    return {};
  }
}

export async function saveOnboardingDraft(userId: string, patch: OnboardingDraft) {
  const current = await getOnboardingDraft(userId);
  await AsyncStorage.setItem(DRAFT_KEY(userId), JSON.stringify({ ...current, ...patch }));
}

/**
 * Fills a step with the answer saved for it earlier, once, when it opens.
 * Going back usually returns to the same (still mounted) screen, but after the
 * app was closed mid-onboarding the earlier steps are rebuilt fresh; this way
 * they show what was picked instead of starting blank.
 */
export function useSavedAnswer<K extends keyof OnboardingDraft>(
  userId: string | null | undefined,
  preview: boolean,
  key: K,
  /** A state setter (stable), so it never re-triggers the load. */
  apply: (value: NonNullable<OnboardingDraft[K]>) => void,
) {
  useEffect(() => {
    if (!userId || preview) return;
    let cancelled = false;
    void getOnboardingDraft(userId).then((draft) => {
      const value = draft[key];
      if (!cancelled && value !== undefined && value !== null) apply(value as NonNullable<OnboardingDraft[K]>);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, preview, key, apply]);
}

/** Go to the step after `current` (saving it, unless previewing). */
export async function goNext(
  router: ReturnType<typeof useRouter>,
  current: OnboardingStep,
  {
    userId,
    preview,
    replace,
  }: {
    userId?: string | null;
    preview?: boolean;
    /** Skip past this screen without leaving it behind (Back won't land on it again). */
    replace?: boolean;
  },
) {
  const next = nextStep(current);
  if (!next) return;
  // A quick double tap on Continue would push the next step twice.
  const now = Date.now();
  if (lastGoNext.step === current && now - lastGoNext.at < 800) return;
  lastGoNext = { step: current, at: now };
  if (userId && !preview) await setOnboardingStep(userId, next);
  if (replace) router.replace(stepRoute(next, preview));
  else router.push(stepRoute(next, preview));
}
let lastGoNext = { step: '' as string, at: 0 };

/** Called when the paywall is done: onboarding complete, the tour is next. */
export async function finishOnboarding(userId: string | null | undefined, preview = false) {
  if (preview) {
    previewTourRequested = true;
    return;
  }
  if (!userId) return;
  await setOnboardingStep(userId, 'done');
  await AsyncStorage.setItem(TOUR_KEY(userId), '1');
}

/** Dev preview asks for the tour without touching storage. */
let previewTourRequested = false;

export async function consumeTourPending(userId: string | null | undefined): Promise<boolean> {
  if (previewTourRequested) {
    previewTourRequested = false;
    return true;
  }
  if (!userId) return false;
  const v = await AsyncStorage.getItem(TOUR_KEY(userId));
  if (v !== '1') return false;
  await AsyncStorage.removeItem(TOUR_KEY(userId));
  return true;
}
