import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type Props = {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
  /** 'filled' is the ink pill (Apple, the main action); 'outline' the bordered one. */
  variant?: 'filled' | 'outline';
  loading?: boolean;
  disabled?: boolean;
};

/** The full-width pill used on the sign-up and sign-in pages (onboarding style). */
export function AuthChoiceButton({ label, icon, onPress, variant = 'outline', loading, disabled }: Props) {
  const { colors } = useTheme();
  const filled = variant === 'filled';
  const fg = filled ? colors.background : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.btn,
        filled ? { backgroundColor: colors.text } : { backgroundColor: colors.background, borderWidth: 2, borderColor: colors.text },
        { opacity: disabled && !loading ? 0.5 : pressed ? 0.85 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontSize: 17, fontWeight: '800' },
});
