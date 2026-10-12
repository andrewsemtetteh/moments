import { OtpCodeInput } from '@/components/auth/OtpCodeInput';
import { SettingsEditPage } from '@/components/profile/SettingsEditPage';

type Props = {
  visible: boolean;
  email: string;
  code: string;
  saving?: boolean;
  onChangeCode: (code: string) => void;
  onClose: () => void;
  onSave: () => void;
};

/** Step two of changing your email: the 6-digit code, on its own page. */
export function VerifyEmailCodeModal({ visible, email, code, saving = false, onChangeCode, onClose, onSave }: Props) {
  return (
    <SettingsEditPage
      visible={visible}
      title="Verify email"
      hint={`Enter the 6-digit code we sent to ${email}.`}
      buttonLabel="Verify"
      canSave={code.length === 6}
      saving={saving}
      onSave={onSave}
      onClose={onClose}>
      <OtpCodeInput value={code} onChange={onChangeCode} />
    </SettingsEditPage>
  );
}
