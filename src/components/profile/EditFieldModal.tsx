import type { KeyboardTypeOptions, TextInputProps } from 'react-native';

import { SettingsEditPage, SettingsField } from '@/components/profile/SettingsEditPage';

type Props = {
  visible: boolean;
  title: string;
  label: string;
  value: string;
  placeholder?: string;
  saving?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  maxLength?: number;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
};

/** Edit one text setting (name, space name, email) on its own page. */
export function EditFieldModal({
  visible,
  title,
  label,
  value,
  placeholder,
  saving = false,
  keyboardType,
  autoCapitalize = 'sentences',
  maxLength,
  onChange,
  onClose,
  onSave,
}: Props) {
  return (
    <SettingsEditPage
      visible={visible}
      title={title}
      hint={label}
      buttonLabel="Save"
      canSave={!!value.trim()}
      saving={saving}
      onSave={onSave}
      onClose={onClose}>
      <SettingsField
        label={title}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        autoCorrect={false}
        returnKeyType="done"
        onSubmitEditing={() => {
          if (value.trim() && !saving) onSave();
        }}
      />
    </SettingsEditPage>
  );
}
