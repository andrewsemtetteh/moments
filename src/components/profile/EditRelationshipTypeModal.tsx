import { SettingsChoiceSheet } from '@/components/profile/SettingsEditPage';
import { RELATIONSHIP_TYPE_OPTIONS } from '@/lib/relationship-type';
import type { RelationshipType } from '@/types/database';

type Props = {
  visible: boolean;
  value: RelationshipType | null | undefined;
  savingValue?: RelationshipType | null;
  onSelect: (value: RelationshipType) => void;
  onClose: () => void;
};

/** Pick your relationship type; tapping one saves it. */
export function EditRelationshipTypeModal({ visible, value, savingValue, onSelect, onClose }: Props) {
  return (
    <SettingsChoiceSheet
      visible={visible}
      title="Relationship type"
      hint="Helps personalise reminders and what Home says for the two of you."
      options={RELATIONSHIP_TYPE_OPTIONS}
      value={value}
      savingValue={savingValue}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}
