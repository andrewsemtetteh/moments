import * as Haptics from '@/lib/haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

export type PlayTab = 'all' | 'handpicked' | 'endless';

const TABS: { id: PlayTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'handpicked', label: 'Handpicked' },
  { id: 'endless', label: 'Endless' },
];

export function PlayTabs({ value, onChange }: { value: PlayTab; onChange: (tab: PlayTab) => void }) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.track, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      {TABS.map((tab) => {
        const selected = tab.id === value;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              void Haptics.selectionAsync();
              onChange(tab.id);
            }}
            style={[styles.tab, selected && { backgroundColor: colors.text }]}>
            <Text
              style={[
                styles.label,
                { color: selected ? colors.background : colors.textSecondary, fontWeight: selected ? '800' : '700' },
              ]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flexGrow: 1,
    flexBasis: 'auto',
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 14 },
});
