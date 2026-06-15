import Svg, { Path } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { getStreamingPlatform } from '@/constants/streaming-platforms';
import { getStreamingBrandIcon } from '@/lib/streaming-brand-icons';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  platformId: string;
  size?: number;
};

export function StreamingPlatformIcon({ platformId, size = 40 }: Props) {
  const { colors } = useTheme();
  const platform = getStreamingPlatform(platformId);
  const brand = getStreamingBrandIcon(platform.id);
  const plateSize = size;
  const inner = Math.round(size * 0.62);
  const plateBg = colors.isDark ? '#FFFFFF' : '#FFFFFF';
  const plateBorder = colors.isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';

  if (platform.id === 'other' || !brand) {
    return (
      <View
        style={[
          styles.plate,
          {
            width: plateSize,
            height: plateSize,
            borderRadius: plateSize * 0.22,
            backgroundColor: plateBg,
            borderColor: plateBorder,
          },
        ]}>
        {platform.id === 'other' ? (
          <Icon name="globe" size={inner * 0.72} color={platform.brandColor} />
        ) : (
          <Text style={[styles.fallbackLetter, { fontSize: inner * 0.42, color: platform.brandColor }]}>
            {platform.name.charAt(0)}
          </Text>
        )}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.plate,
        {
          width: plateSize,
          height: plateSize,
          borderRadius: plateSize * 0.22,
          backgroundColor: plateBg,
          borderColor: plateBorder,
        },
      ]}
      accessibilityLabel={`${platform.name} logo`}>
      {brand.type === 'svg' ? (
        <Svg width={inner} height={inner} viewBox="0 0 24 24">
          <Path d={brand.path} fill={`#${brand.hex}`} />
        </Svg>
      ) : (
        <Text
          style={[
            styles.brandLabel,
            {
              fontSize: brand.fontSize ?? inner * 0.34,
              color: `#${brand.hex}`,
            },
          ]}
          numberOfLines={1}>
          {brand.label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  fallbackLetter: {
    fontWeight: '800',
  },
  brandLabel: {
    fontWeight: '900',
    letterSpacing: -0.3,
    textAlign: 'center',
    maxWidth: '92%',
  },
});
