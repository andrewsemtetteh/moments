export const ONBOARDING_PROGRESS_TOTAL = 7;

export type OnboardingFlowStepId =
  | 'profile-name'
  | 'profile-setup'
  | 'profile-gender'
  | 'anniversary-setup'
  | 'relationship-type'
  | 'relationship-path'
  | 'create-relationship'
  | 'join-relationship';

export type OnboardingFlowStep = {
  id: OnboardingFlowStepId;
  route: `/(onboarding)/${OnboardingFlowStepId}`;
  progressIndex: number;
};

export const ONBOARDING_FLOW_STEPS: OnboardingFlowStep[] = [
  { id: 'profile-name', route: '/(onboarding)/profile-name', progressIndex: 0 },
  { id: 'profile-setup', route: '/(onboarding)/profile-setup', progressIndex: 1 },
  { id: 'profile-gender', route: '/(onboarding)/profile-gender', progressIndex: 2 },
  { id: 'anniversary-setup', route: '/(onboarding)/anniversary-setup', progressIndex: 3 },
  { id: 'relationship-type', route: '/(onboarding)/relationship-type', progressIndex: 4 },
  { id: 'relationship-path', route: '/(onboarding)/relationship-path', progressIndex: 5 },
  { id: 'create-relationship', route: '/(onboarding)/create-relationship', progressIndex: 6 },
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
