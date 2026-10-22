import * as Haptics from '@/lib/haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { PlayChip, playCardStyle } from '@/components/play/PlayKit';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { MAX_ROUNDS, UNLIMITED_ROUNDS } from '@/lib/game-room/reducer';

/**
 * How many rounds: the game's usual counts, Unlimited (questions keep coming until you end it),
 * or Custom (any number, with − and +). `value` 0 is Unlimited.
 */
export function RoundPicker({
  options,
  value,
  onChange,
  disabled = false,
}: {
  options: number[];
  value: number;
  onChange: (rounds: number) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const unlimited = value === UNLIMITED_ROUNDS;
  const isCustomValue = !unlimited && !options.includes(value);
  // Custom stays open once chosen (even if its number happens to match a preset).
  const [customOpen, setCustomOpen] = useState(isCustomValue);
  const custom = customOpen || isCustomValue;
  const number = unlimited ? options[options.length - 1] : value;

  const step = (delta: number) => {
    void Haptics.selectionAsync();
    onChange(Math.max(1, Math.min(MAX_ROUNDS, number + delta)));
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {options.map((n) => (
          <PlayChip
            key={n}
            label={String(n)}
            wide
            selected={!custom && !unlimited && value === n}
            disabled={disabled}
            onPress={() => {
              setCustomOpen(false);
              onChange(n);
            }}
          />
        ))}
        <PlayChip
          label="Unlimited"
          selected={unlimited}
          disabled={disabled}
          onPress={() => {
            setCustomOpen(false);
            onChange(UNLIMITED_ROUNDS);
          }}
        />
        <PlayChip
          label="Custom"
          selected={custom && !unlimited}
          disabled={disabled}
          onPress={() => {
            setCustomOpen(true);
            if (unlimited) onChange(number);
          }}
        />
      </View>

      {custom && !unlimited ? (
        <View style={[styles.stepper, playCardStyle(colors)]}>
          <StepButton icon="minus" onPress={() => step(-1)} disabled={disabled || number <= 1} label="Fewer rounds" />
          <View style={styles.stepValue}>
            <Text style={[styles.stepNum, { color: colors.text }]}>{number}</Text>
            <Text style={[styles.stepUnit, { color: colors.textSecondary }]}>{number === 1 ? 'round' : 'rounds'}</Text>
          </View>
          <StepButton icon="plus" onPress={() => step(1)} disabled={disabled || number >= MAX_ROUNDS} label="More rounds" />
        </View>
      ) : null}

      {unlimited ? (
        <Text style={[styles.hint, { color: colors.textSecondary }]}>
          Questions keep coming until one of you ends the game.
        </Text>
      ) : null}
    </View>
  );
}

function StepButton({
  icon,
  onPress,
  disabled,
  label,
}: {
  icon: 'minus' | 'plus';
  onPress: () => void;
  disabled: boolean;
  label: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.stepBtn,
        { backgroundColor: colors.accent, opacity: disabled ? 0.35 : pressed ? 0.8 : 1 },
      ]}>
      {icon === 'plus' ? (
        <Icon name="plus" size={22} color={colors.onAccent} />
      ) : (
        <View style={[styles.minusBar, { backgroundColor: colors.onAccent }]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 10, gap: 12 },
  stepBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  minusBar: { width: 16, height: 2.5, borderRadius: 2 },
  stepValue: { flex: 1, alignItems: 'center' },
  stepNum: { fontSize: 26, fontWeight: '900', fontVariant: ['tabular-nums'] },
  stepUnit: { fontSize: 12, fontWeight: '700' },
  hint: { fontSize: 13, fontWeight: '600' },
});
