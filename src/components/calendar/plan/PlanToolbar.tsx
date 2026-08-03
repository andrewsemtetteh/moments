import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

const ICON = 24;

export function PlanToolbar({
  month,
  mode,
  onToggleMode,
  onAdd,
  onPrevMonth,
  onNextMonth,
}: {
  month: Date;
  mode: 'week' | 'month';
  onToggleMode: () => void;
  onAdd: () => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
}) {
  const { colors } = useTheme();
  const inMonth = mode === 'month';

  return (
    <View style={styles.row}>
      <Text style={[styles.month, { color: colors.text }]}>{format(month, 'MMMM yyyy')}</Text>

      <View style={styles.actions}>
        {inMonth ? (
          <>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onPrevMonth?.();
              }}
              hitSlop={8}
              style={styles.iconBtn}
              accessibilityLabel="Previous month">
              <Icon name="chevronLeft" size={ICON} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onNextMonth?.();
              }}
              hitSlop={8}
              style={styles.iconBtn}
              accessibilityLabel="Next month">
              <Icon name="chevronRight" size={ICON} color={colors.text} />
            </Pressable>
          </>
        ) : null}

        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            onToggleMode();
          }}
          hitSlop={8}
          style={[styles.iconBtn, inMonth && { backgroundColor: colors.accentSoft, borderRadius: 20 }]}
          accessibilityLabel={inMonth ? 'Show week' : 'Show month'}
          accessibilityState={{ selected: inMonth }}>
          <Icon name="calendar" size={ICON} color={inMonth ? colors.accent : colors.text} filled={inMonth} />
        </Pressable>

        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onAdd();
          }}
          hitSlop={8}
          style={styles.iconBtn}
          accessibilityLabel="Add plan">
          <Icon name="plus" size={ICON} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 2,
    minHeight: 48,
  },
  month: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
