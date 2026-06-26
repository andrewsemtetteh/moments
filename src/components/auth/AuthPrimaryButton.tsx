import { StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { PrimaryButton } from '@/components/ui/primitives';

type Props = {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
};

/** Compact primary CTA sized like standard iOS / Material auth screens. */
export function AuthPrimaryButton({ style, textStyle, ...rest }: Props) {
  return (
    <PrimaryButton
      {...rest}
      style={[styles.btn, style]}
      textStyle={[styles.text, textStyle]}
    />
  );
}

const styles = StyleSheet.create({
  btn: {
    paddingVertical: 13,
    borderRadius: 12,
    minHeight: 48,
  },
  text: {
    fontSize: 15,
    fontWeight: '700',
  },
});
