import type { RelationshipType } from '@/types/database';

export const RELATIONSHIP_TYPE_OPTIONS: { value: RelationshipType; label: string }[] = [
  { value: 'dating', label: 'Dating' },
  { value: 'long_distance', label: 'Long-distance' },
  { value: 'engaged', label: 'Engaged' },
  { value: 'married', label: 'Married' },
  { value: 'other', label: 'Other' },
];

export function relationshipTypeLabel(type: RelationshipType | null | undefined): string {
  if (!type) return 'Not set';
  return RELATIONSHIP_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? 'Not set';
}
