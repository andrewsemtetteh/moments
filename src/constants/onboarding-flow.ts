export const ONBOARDING_PROGRESS_TOTAL = 11;

export type OnboardingFlowStepId =
  | 'signup-email'
  | 'profile-name'
  | 'profile-setup'
  | 'profile-gender'
  | 'anniversary-setup'
  | 'relationship-type'
  | 'relationship-path'
  | 'create-relationship'
  | 'join-relationship'
  | 'theme-picker'
  | 'widget-prompt'
  | 'notification-prompt';

export type OnboardingFlowStep = {
  id: OnboardingFlowStepId;
  route: `/(auth)/${OnboardingFlowStepId}` | `/(onboarding)/${OnboardingFlowStepId}`;
  progressIndex: number;
};

/**
 * One continuous progress bar from the moment someone picks "Continue with
 * Email" through the last onboarding screen — email+password is step 0 of
 * the same stretch as the rest of onboarding, not a separate modal flow.
 * theme-picker/widget-prompt/notification-prompt sit after the relationship
 * is created/joined, since that's the point of no return — no back button
 * makes sense past it (see OnboardingChrome's optional `onBack`).
 */
export const ONBOARDING_FLOW_STEPS: OnboardingFlowStep[] = [
  { id: 'signup-email', route: '/(auth)/signup-email', progressIndex: 0 },
  { id: 'profile-name', route: '/(onboarding)/profile-name', progressIndex: 1 },
  { id: 'profile-setup', route: '/(onboarding)/profile-setup', progressIndex: 2 },
  { id: 'profile-gender', route: '/(onboarding)/profile-gender', progressIndex: 3 },
  { id: 'anniversary-setup', route: '/(onboarding)/anniversary-setup', progressIndex: 4 },
  { id: 'relationship-type', route: '/(onboarding)/relationship-type', progressIndex: 5 },
  { id: 'relationship-path', route: '/(onboarding)/relationship-path', progressIndex: 6 },
  { id: 'create-relationship', route: '/(onboarding)/create-relationship', progressIndex: 7 },
  { id: 'theme-picker', route: '/(onboarding)/theme-picker', progressIndex: 8 },
  { id: 'widget-prompt', route: '/(onboarding)/widget-prompt', progressIndex: 9 },
  { id: 'notification-prompt', route: '/(onboarding)/notification-prompt', progressIndex: 10 },
];

export function getOnboardingStep(stepId: OnboardingFlowStepId): OnboardingFlowStep {
  const step = ONBOARDING_FLOW_STEPS.find((item) => item.id === stepId);
  if (!step) return ONBOARDING_FLOW_STEPS[0];
  return step;
}

export function getOnboardingProgressIndex(stepId: OnboardingFlowStepId): number {
  if (stepId === 'join-relationship') {
    return getOnboardingStep('create-relationship').progressIndex;
  }
  return getOnboardingStep(stepId).progressIndex;
}
