export type ExperienceCategory = 'eat' | 'stay' | 'visit' | 'do';

export const EXPERIENCE_CATEGORIES: { id: ExperienceCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'eat', label: 'Eat' },
  { id: 'stay', label: 'Stay' },
  { id: 'visit', label: 'Visit' },
  { id: 'do', label: 'Do' },
];

const EAT_TYPES = new Set(['restaurant', 'food', 'cafe', 'brunch', 'bar', 'dining']);
const STAY_TYPES = new Set(['hotel', 'airbnb', 'staycation', 'resort', 'stay', 'bnb']);
const VISIT_TYPES = new Set(['attraction', 'museum', 'landmark', 'park', 'outdoor', 'visit', 'getaway']);

export function getExperienceCategory(type: string | null | undefined): ExperienceCategory {
  const key = (type ?? '').toLowerCase().trim();
  if (EAT_TYPES.has(key)) return 'eat';
  if (STAY_TYPES.has(key)) return 'stay';
  if (VISIT_TYPES.has(key)) return 'visit';
  return 'do';
}

export function getExperienceCategoryLabel(category: ExperienceCategory): string {
  return EXPERIENCE_CATEGORIES.find((c) => c.id === category)?.label ?? 'Do';
}
