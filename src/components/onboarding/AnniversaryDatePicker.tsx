import { StyleSheet, Text, View } from 'react-native';

import { AnniversaryWheelPicker } from '@/components/onboarding/AnniversaryWheelPicker';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  value: string;
  onChange: (isoDate: string) => void;
  title?: string;
  subtitle?: string;
  surfaceColor?: string;
};

export function AnniversaryDatePicker({
  value,
  onChange,
  title = 'When did you get together?',
  subtitle = 'We use this for your anniversary countdown. You can change it anytime in Profile.',
  surfaceColor,
}: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.sub, { color: colors.textSecondary }]}>{subtitle}</Text>

      <AnniversaryWheelPicker value={value} onChange={onChange} surfaceColor={surfaceColor} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center', gap: 12 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center', letterSpacing: -0.5 },
  sub: { fontSize: 16, textAlign: 'center', lineHeight: 22, maxWidth: 320, marginBottom: 8 },
});
