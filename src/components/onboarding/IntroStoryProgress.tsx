import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';

type Props = {
  total: number;
  index: number;
};

export function IntroStoryProgress({ total, index }: Props) {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, i) => {
        const filled = i <= index;
        return (
          <View key={i} style={[styles.track, { backgroundColor: colors.borderStrong }]}>
            <View
              style={[
                styles.fill,
                {
                  backgroundColor: colors.text,
                  width: filled ? '100%' : '0%',
                },
              ]}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    minHeight: 3,
  },
  track: {
    flex: 1,
    height: 3,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
});
