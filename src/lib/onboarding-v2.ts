import AsyncStorage from '@react-native-async-storage/async-storage';
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

export function stepIndex(step: OnboardingStep) {
  return ONBOARDING_STEPS.indexOf(step);
}

/** 0…1 for the progress bar. */
export function stepProgress(step: OnboardingStep) {
  return (stepIndex(step) + 1) / ONBOARDING_STEPS.length;
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

/** Go to the step after `current` (saving it, unless previewing). */
export async function goNext(
  router: ReturnType<typeof useRouter>,
  current: OnboardingStep,
  { userId, preview }: { userId?: string | null; preview?: boolean },
) {
  const next = ONBOARDING_STEPS[stepIndex(current) + 1];
  if (!next) return;
  if (userId && !preview) await setOnboardingStep(userId, next);
  router.push(stepRoute(next, preview));
}

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
