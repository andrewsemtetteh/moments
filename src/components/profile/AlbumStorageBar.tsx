import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { formatStorageBytes, storageUsagePercent } from '@/lib/shared-album';

interface AlbumStorageBarProps {
  usedBytes: number;
  limitBytes: number;
  isPlus: boolean;
  onUpgrade: () => void;
}

export function AlbumStorageBar({ usedBytes, limitBytes, isPlus, onUpgrade }: AlbumStorageBarProps) {
  const { colors } = useTheme();
  const percent = isPlus ? 0 : storageUsagePercent(usedBytes, limitBytes);
  const nearFull = !isPlus && percent >= 85;

  if (isPlus) {
    return (
      <View style={[styles.wrap, { borderBottomColor: colors.border }]}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {formatStorageBytes(usedBytes)} stored · Unlimited with Plus
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={nearFull ? onUpgrade : undefined}
      style={[styles.wrap, { borderBottomColor: colors.border }]}>
      <View style={styles.row}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {formatStorageBytes(usedBytes)} of {formatStorageBytes(limitBytes)} used
        </Text>
        {nearFull ? (
          <Text style={[styles.upgrade, { color: colors.accent }]}>Upgrade</Text>
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceElevated }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${percent}%`,
              backgroundColor: nearFull ? colors.error : colors.accent,
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 12, fontWeight: '700' },
  upgrade: { fontSize: 12, fontWeight: '800' },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
