import * as Haptics from 'expo-haptics';
import { type ReactNode, useMemo, useState } from 'react';
import { PixelRatio, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { StreamingPlatformIcon } from '@/components/watch/StreamingPlatformIcon';
import {
  STREAMING_PLATFORMS,
  type StreamingPlatform,
  type StreamingPlatformId,
} from '@/constants/streaming-platforms';
import { useTheme } from '@/hooks/useTheme';

export const STREAMING_GRID_COLS = 4;
export const STREAMING_GRID_GAP = 10;

export function computeStreamingTileWidth(gridWidth: number): number {
  if (gridWidth <= 0) return 0;
  const raw = (gridWidth - STREAMING_GRID_GAP * (STREAMING_GRID_COLS - 1)) / STREAMING_GRID_COLS;
  return PixelRatio.roundToNearestPixel(raw);
}

function chunkPlatforms(platforms: StreamingPlatform[], cols: number): StreamingPlatform[][] {
  const rows: StreamingPlatform[][] = [];
  for (let i = 0; i < platforms.length; i += cols) {
    rows.push(platforms.slice(i, i + cols));
  }
  return rows;
}

type StreamingServiceGridProps = {
  selectedId: StreamingPlatformId | null;
  onSelect: (id: StreamingPlatformId) => void;
  onLongPress?: (id: StreamingPlatformId) => void;
  platforms?: StreamingPlatform[];
  iconSize?: number;
  showLabels?: boolean;
  renderBadge?: (platform: StreamingPlatform) => ReactNode;
  style?: ViewStyle;
};

export function StreamingServiceGrid({
  selectedId,
  onSelect,
  onLongPress,
  platforms = STREAMING_PLATFORMS,
  iconSize = 30,
  showLabels = true,
  renderBadge,
  style,
}: StreamingServiceGridProps) {
  const { colors } = useTheme();
  const [gridWidth, setGridWidth] = useState(0);
  const tileWidth = computeStreamingTileWidth(gridWidth);

  const rows = useMemo(() => chunkPlatforms(platforms, STREAMING_GRID_COLS), [platforms]);

  return (
    <View
      style={[styles.root, style]}
      onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
      {rows.map((row, rowIndex) => (
        <View
          key={row.map((p) => p.id).join('-')}
          style={[
            styles.row,
            rowIndex < rows.length - 1 && { marginBottom: STREAMING_GRID_GAP },
          ]}>
          {row.map((platform) => {
            const selected = selectedId === platform.id;
            return (
              <Pressable
                key={platform.id}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onSelect(platform.id);
                }}
                onLongPress={onLongPress ? () => onLongPress(platform.id) : undefined}
                style={[
                  styles.tile,
                  tileWidth > 0 && { width: tileWidth },
                  {
                    backgroundColor: selected ? colors.accentSoft : colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                ]}>
                <StreamingPlatformIcon platformId={platform.id} size={iconSize} />
                {showLabels && (
                  <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
                    {platform.name}
                  </Text>
                )}
                {renderBadge?.(platform)}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { width: '100%' },
  row: {
    flexDirection: 'row',
    width: '100%',
    gap: STREAMING_GRID_GAP,
  },
  tile: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  label: {
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
    width: '100%',
  },
});
