import * as Haptics from '@/lib/haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { shade } from '@/components/games/room-ui';
import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';

/** A question's options to tap, one per row; the chosen one fills with the colour and gets a tick. */
export function PickList({
  picks,
  value,
  onChange,
  accent,
}: {
  picks: string[];
  value: string | null;
  onChange: (pick: string | null) => void;
  accent: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.picks}>
      {picks.map((p) => {
        const selected = value === p;
        return (
          <Pressable
            key={p}
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(selected ? null : p);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[
              styles.pick,
              {
                backgroundColor: selected ? accent : colors.surfaceElevated,
                borderColor: selected ? shade(accent, -0.25) : colors.border,
              },
            ]}>
            <Text style={[styles.pickText, { color: selected ? '#FFFFFF' : colors.text }]}>{p}</Text>
            {selected ? <Icon name="check" size={16} color="#FFFFFF" /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  picks: { gap: 8 },
  pick: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  pickText: { flex: 1, fontSize: 16, fontWeight: '700' },
});
