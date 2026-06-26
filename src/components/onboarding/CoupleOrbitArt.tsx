import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import * as Font from 'expo-font';

import { LogoMark } from '@/components/ui/Logo';
import { colorWithAlpha } from '@/components/ui/primitives';

const BASE_SIZE = 260;
/** Original ring diameters — outer, middle, inner. */
const RING_DIAMETERS_BASE = [228, 172, 114] as const;
const CENTER_LOGO_SIZE = 72;
/** Extra canvas padding so outer-ring icons are not clipped. */
const ICON_BLEED_BASE = 10;
const ICON_COLOR = '#FFFFFF';
const IONICON_FAMILY = 'ionicons';

function useIoniconsReady() {
  const [ready, setReady] = useState(() => Font.isLoaded(IONICON_FAMILY));

  useEffect(() => {
    if (ready) return;
    let mounted = true;
    void Ionicons.loadFont().then(() => {
      if (mounted) setReady(true);
    });
    return () => {
      mounted = false;
    };
  }, [ready]);

  return ready;
}

type IonName = ComponentProps<typeof Ionicons>['name'];

type OrbitIcon = {
  name: IonName;
  angle: number;
  ring: 0 | 1 | 2;
  iconSize: number;
};

const ORBIT_ICONS: OrbitIcon[] = [
  { name: 'chatbubbles-outline', angle: 244, ring: 0, iconSize: 40 },
  { name: 'flame-outline', angle: 192, ring: 0, iconSize: 30 },
  { name: 'calendar-outline', angle: 28, ring: 0, iconSize: 26 },
  { name: 'camera-outline', angle: 318, ring: 1, iconSize: 36 },
  { name: 'film-outline', angle: 102, ring: 1, iconSize: 22 },
  { name: 'location-outline', angle: 168, ring: 2, iconSize: 28 },
  { name: 'gift-outline', angle: 72, ring: 2, iconSize: 22 },
];

function getRingRadii(canvasSize: number): [number, number, number] {
  const s = canvasSize / BASE_SIZE;
  return RING_DIAMETERS_BASE.map((diameter) => (diameter / 2) * s) as [number, number, number];
}

function polar(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: cx + Math.cos(rad) * radius,
    y: cy + Math.sin(rad) * radius,
  };
}

function normalizeAngle(angle: number) {
  return ((angle % 360) + 360) % 360;
}

function gapDegrees(iconSize: number, radius: number, scale: number) {
  const half = (iconSize * scale) / 2 + 0.5;
  return (((Math.asin(Math.min(1, half / radius)) * 180) / Math.PI) * 2) * 0.82;
}

function mergeGapIntervals(intervals: { start: number; end: number }[]) {
  if (intervals.length === 0) return [];

  const normalized = intervals
    .map(({ start, end }) => {
      const s = normalizeAngle(start);
      const e = normalizeAngle(end);
      if (s <= e) return [{ start: s, end: e }];
      return [
        { start: s, end: 360 },
        { start: 0, end: e },
      ];
    })
    .flat()
    .sort((a, b) => a.start - b.start);

  const merged: { start: number; end: number }[] = [normalized[0]];
  for (let i = 1; i < normalized.length; i += 1) {
    const prev = merged[merged.length - 1];
    const cur = normalized[i];
    if (cur.start <= prev.end + 0.5) {
      prev.end = Math.max(prev.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

function visibleArcs(
  icons: { angle: number; iconSize: number }[],
  radius: number,
  scale: number,
) {
  if (icons.length === 0) return [{ start: 0, end: 360 }];

  const gaps = mergeGapIntervals(
    icons.map((icon) => {
      const span = gapDegrees(icon.iconSize, radius, scale);
      return { start: icon.angle - span / 2, end: icon.angle + span / 2 };
    }),
  );

  const arcs: { start: number; end: number }[] = [];
  let cursor = 0;

  for (const gap of gaps) {
    if (gap.start > cursor + 1) {
      arcs.push({ start: cursor, end: gap.start });
    }
    cursor = Math.max(cursor, gap.end);
  }

  if (cursor < 359) {
    arcs.push({ start: cursor, end: 360 });
  }

  return arcs.filter((arc) => arc.end - arc.start > 2);
}

function arcPath(cx: number, cy: number, radius: number, start: number, end: number) {
  const s = polar(cx, cy, radius, start);
  const e = polar(cx, cy, radius, end);
  const sweep = end - start;
  const largeArc = sweep > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
}

function OrbitBadge({
  item,
  center,
  radius,
  scale,
}: {
  item: OrbitIcon;
  center: number;
  radius: number;
  scale: number;
}) {
  const rad = (item.angle * Math.PI) / 180;
  const x = Math.cos(rad) * radius;
  const y = Math.sin(rad) * radius;
  const iconSize = item.iconSize * scale;
  const half = iconSize / 2;

  return (
    <View
      style={[
        styles.marker,
        {
          left: center + x - half,
          top: center + y - half,
          width: iconSize,
          height: iconSize,
        },
      ]}>
      <Ionicons name={item.name} size={iconSize} color={ICON_COLOR} />
    </View>
  );
}

export function CoupleOrbitArt({ size = BASE_SIZE }: { size?: number }) {
  const iconsReady = useIoniconsReady();
  const scale = size / BASE_SIZE;
  const bleed = ICON_BLEED_BASE * scale;
  const wrapSize = size + bleed * 2;
  const center = size / 2 + bleed;
  const ringRadii = getRingRadii(size);
  const logoSize = CENTER_LOGO_SIZE * scale;
  const ringStroke = colorWithAlpha('#FFFFFF', 0.32);
  const strokeWidth = 1.25;

  if (!iconsReady) {
    return <View style={[styles.wrap, { width: wrapSize, height: wrapSize }]} />;
  }

  return (
    <View style={[styles.wrap, { width: wrapSize, height: wrapSize }]}>
      <Svg width={wrapSize} height={wrapSize} style={StyleSheet.absoluteFill}>
        {ringRadii.map((radius, ringIndex) => {
          const iconsOnRing = ORBIT_ICONS.filter((icon) => icon.ring === ringIndex).map((icon) => ({
            angle: icon.angle,
            iconSize: icon.iconSize,
          }));
          const arcs = visibleArcs(iconsOnRing, radius, scale);

          return arcs.map((arc, arcIndex) => (
            <Path
              key={`ring-${ringIndex}-${arcIndex}`}
              d={arcPath(center, center, radius, arc.start, arc.end)}
              stroke={ringStroke}
              strokeWidth={strokeWidth}
              fill="none"
            />
          ));
        })}
      </Svg>

      {ORBIT_ICONS.map((item, index) => (
        <OrbitBadge
          key={`orbit-${index}`}
          item={item}
          center={center}
          radius={ringRadii[item.ring]}
          scale={scale}
        />
      ))}

      <View
        style={[
          styles.core,
          {
            left: center - logoSize / 2,
            top: center - logoSize / 2,
            width: logoSize,
            height: logoSize,
          },
        ]}
        pointerEvents="none">
        <LogoMark size={logoSize} variant="png" style={styles.logo} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', position: 'relative', overflow: 'visible' },
  core: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    elevation: 20,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  marker: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
});
