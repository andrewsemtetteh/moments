import { SettingsChoiceSheet } from '@/components/profile/SettingsEditPage';
import { PROFILE_GENDER_OPTIONS } from '@/lib/profile-gender';
import type { ProfileGender } from '@/types/database';

type Props = {
  visible: boolean;
  value: ProfileGender | null | undefined;
  savingValue?: ProfileGender | null;
  onSelect: (value: ProfileGender) => void;
  onClose: () => void;
};

/** Pick a gender; tapping one saves it. */
export function EditGenderModal({ visible, value, savingValue, onSelect, onClose }: Props) {
  return (
    <SettingsChoiceSheet
      visible={visible}
      title="Gender"
      hint="Optional. It helps us personalise Moments for you."
      options={PROFILE_GENDER_OPTIONS}
      value={value}
      savingValue={savingValue}
      onSelect={onSelect}
      onClose={onClose}
    />
  );
}
