import type { RelationshipType } from '@/types/database';

export type OnboardingRelationshipParams = {
  anniversaryDate?: string;
  anniversarySkipped?: string;
  relationshipType?: string;
  relationshipTypeSkipped?: string;
  spacePathChosen?: string;
};

type BuildOptions = {
  anniversaryDate?: string | null;
  anniversarySkipped?: boolean;
  relationshipType?: RelationshipType | null;
  relationshipTypeSkipped?: boolean;
  spacePathChosen?: 'create' | 'join';
};

export type ParsedOnboardingRelationshipParams = BuildOptions;

export function buildOnboardingRelationshipParams(options: BuildOptions): Record<string, string> {
  const params: Record<string, string> = {};

  if (options.anniversaryDate) {
    params.anniversaryDate = options.anniversaryDate;
  } else if (options.anniversarySkipped) {
    params.anniversarySkipped = '1';
  }

  if (options.relationshipType) {
    params.relationshipType = options.relationshipType;
  } else if (options.relationshipTypeSkipped) {
    params.relationshipTypeSkipped = '1';
  }

  if (options.spacePathChosen) {
    params.spacePathChosen = options.spacePathChosen;
  }

  return params;
}

export function paramsFromSearch(
  params: OnboardingRelationshipParams,
): BuildOptions {
  return {
    anniversaryDate:
      typeof params.anniversaryDate === 'string' && params.anniversaryDate.length > 0
        ? params.anniversaryDate
        : null,
    anniversarySkipped: params.anniversarySkipped === '1',
    relationshipType:
      typeof params.relationshipType === 'string'
        ? (params.relationshipType as RelationshipType)
        : null,
    relationshipTypeSkipped: params.relationshipTypeSkipped === '1',
    spacePathChosen:
      params.spacePathChosen === 'create' || params.spacePathChosen === 'join'
        ? params.spacePathChosen
        : undefined,
  };
}

export function hasCompletedPreSpaceOnboarding(params: OnboardingRelationshipParams): boolean {
  const parsed = paramsFromSearch(params);
  const anniversaryDone = !!parsed.anniversaryDate || !!parsed.anniversarySkipped;
  const relationshipTypeDone = !!parsed.relationshipType || !!parsed.relationshipTypeSkipped;
  return anniversaryDone && relationshipTypeDone;
}

export function hasChosenSpacePath(params: OnboardingRelationshipParams): boolean {
  return params.spacePathChosen === 'create' || params.spacePathChosen === 'join';
}
