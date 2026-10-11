import { format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

/**
 * Header row of the Plan calendar card. The month label itself is the
 * week ↔ month toggle (the Apple Calendar / Fantastical pattern) — a chevron
 * beside it rotates to show which way it'll go — instead of a separate icon
 * button. Month arrows only appear while the full month is showing, and a
 * "Today" pill appears whenever the selected day isn't today.
 */
export function PlanToolbar({
  month,
  mode,
  showToday,
  onToggleMode,
  onToday,
  onPrevMonth,
  onNextMonth,
}: {
  month: Date;
  mode: 'week' | 'month';
  showToday: boolean;
  onToggleMode: () => void;
  onToday: () => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
}) {
  const { colors } = useTheme();
  const inMonth = mode === 'month';

  const rotation = useSharedValue(inMonth ? 180 : 0);
  useEffect(() => {
    rotation.value = withTiming(inMonth ? 180 : 0, { duration: 220 });
  }, [inMonth, rotation]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          onToggleMode();
        }}
        hitSlop={8}
        style={({ pressed }) => [styles.monthBtn, pressed && { opacity: 0.6 }]}
        accessibilityRole="button"
        accessibilityLabel={inMonth ? 'Collapse to week' : 'Expand to month'}>
        <Text style={[styles.month, { color: colors.text }]}>{format(month, 'MMMM')}</Text>
        <Text style={[styles.year, { color: colors.textTertiary }]}>{format(month, 'yyyy')}</Text>
        <Animated.View style={chevronStyle}>
          <Icon name="chevronDown" size={16} color={colors.textSecondary} />
        </Animated.View>
      </Pressable>

      <View style={styles.actions}>
        {showToday ? (
          <Pressable
            onPress={() => {
              Haptics.selectionAsync();
              onToday();
            }}
            hitSlop={6}
            style={({ pressed }) => [
              styles.todayPill,
              { backgroundColor: colors.accentSoft, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Jump to today">
            <Text style={[styles.todayText, { color: colors.accent }]}>Today</Text>
          </Pressable>
        ) : null}

        {inMonth ? (
          <>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onPrevMonth?.();
              }}
              hitSlop={6}
              style={({ pressed }) => [
                styles.arrowBtn,
                { backgroundColor: colors.surfaceElevated, opacity: pressed ? 0.6 : 1 },
              ]}
              accessibilityLabel="Previous month">
              <Icon name="chevronLeft" size={16} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync();
                onNextMonth?.();
              }}
              hitSlop={6}
              style={({ pressed }) => [
                styles.arrowBtn,
                { backgroundColor: colors.surfaceElevated, opacity: pressed ? 0.6 : 1 },
              ]}
              accessibilityLabel="Next month">
              <Icon name="chevronRight" size={16} color={colors.text} />
            </Pressable>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 36,
    marginBottom: 12,
  },
  monthBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  month: { fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
  year: { fontSize: 18, fontWeight: '600', letterSpacing: -0.3 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayPill: {
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayText: { fontSize: 13, fontWeight: '700' },
  arrowBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
