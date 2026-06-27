import type { Href } from 'expo-router';
import type { useRouter } from 'expo-router';

import type { OnboardingFlowStepId } from '@/constants/onboarding-flow';
import {
  buildOnboardingRelationshipParams,
  type ParsedOnboardingRelationshipParams,
} from '@/lib/onboarding-relationship-params';

export function getOnboardingBackHref(
  stepId: OnboardingFlowStepId,
  params?: ParsedOnboardingRelationshipParams,
): Href {
  switch (stepId) {
    case 'profile-name':
      return '/(auth)/get-started';
    case 'profile-setup':
      return '/(onboarding)/profile-name';
    case 'profile-gender':
      return '/(onboarding)/profile-setup';
    case 'anniversary-setup':
      return '/(onboarding)/profile-gender';
    case 'relationship-type':
      return '/(onboarding)/anniversary-setup';
    case 'relationship-path':
      return {
        pathname: '/(onboarding)/relationship-type',
        params: params ? buildOnboardingRelationshipParams(params) : undefined,
      };
    case 'create-relationship':
    case 'join-relationship':
      return {
        pathname: '/(onboarding)/relationship-path',
        params: params ? buildOnboardingRelationshipParams(params) : undefined,
      };
    default:
      return '/(onboarding)/profile-name';
  }
}

export function goToOnboardingBack(
  router: ReturnType<typeof useRouter>,
  stepId: OnboardingFlowStepId,
  params?: ParsedOnboardingRelationshipParams,
) {
  router.replace(getOnboardingBackHref(stepId, params) as never);
}
