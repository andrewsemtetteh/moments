import * as Haptics from 'expo-haptics';
import { format } from 'date-fns';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

export function PlanHeader({
  month,
  onPressMonth,
  onPressAdd,
}: {
  month: Date;
  onPressMonth: () => void;
  onPressAdd: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8, backgroundColor: colors.background }]}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onPressMonth();
        }}
        style={styles.monthBtn}
        accessibilityRole="button"
        accessibilityLabel="Expand month calendar">
        <Text style={[styles.month, { color: colors.text }]}>{format(month, 'MMMM yyyy')}</Text>
        <Icon name="chevronDown" size={18} color={colors.textSecondary} />
      </Pressable>

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPressAdd();
        }}
        style={[styles.addBtn, { backgroundColor: colors.accent, shadowColor: colors.shadow }]}
        accessibilityRole="button"
        accessibilityLabel="Create a plan">
        <Icon name="plus" size={24} color={colors.onAccent} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  month: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  addBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
});
