import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { ClipPath, Defs, G, Path, Image as SvgImage, Rect } from 'react-native-svg';

export const MOMENT_BLOB_PATH =
  'M44 2.5C62 0.5 82 10 93 28C104 46 100 68 84 84C68 100 42 103 22 92C2 81 -2 58 6 38C14 18 28 4.5 44 2.5Z';

interface MomentBlobFrameProps {
  width: number;
  height?: number;
  imageUri?: string | null;
  fill?: string;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function MomentBlobFrame({
  width,
  height,
  imageUri,
  fill = '#1C1C1E',
  children,
  style,
}: MomentBlobFrameProps) {
  const h = height ?? width * 1.12;

  return (
    <View style={[{ width, height: h }, style]}>
      <Svg width={width} height={h} viewBox="0 0 100 112">
        <Defs>
          <ClipPath id="momentBlob">
            <Path d={MOMENT_BLOB_PATH} transform="scale(1, 1.12) translate(0, -2)" />
          </ClipPath>
        </Defs>
        <G clipPath="url(#momentBlob)">
          {imageUri ? (
            <SvgImage href={imageUri} width="100" height="112" preserveAspectRatio="xMidYMid slice" />
          ) : (
            <Rect x="0" y="0" width="100" height="112" fill={fill} />
          )}
        </G>
        <Path
          d={MOMENT_BLOB_PATH}
          transform="scale(1, 1.12) translate(0, -2)"
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={0.6}
        />
      </Svg>
      {children ? <View style={styles.overlay}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
});
