import Ionicons from '@expo/vector-icons/Ionicons';
import * as Font from 'expo-font';
import type { ComponentProps } from 'react';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
    Easing,
    makeMutable,
    type SharedValue,
    useAnimatedProps,
    useAnimatedStyle,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { LogoMark } from '@/components/ui/Logo';
import { colorWithAlpha } from '@/components/ui/primitives';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const BASE_SIZE = 260;
/** Original ring diameters — outer, middle, inner. */
const RING_DIAMETERS_BASE = [228, 172, 114] as const;
const CENTER_LOGO_SIZE = 72;
/** Extra canvas padding so outer-ring icons are not clipped. */
const ICON_BLEED_BASE = 10;
const ICON_COLOR = '#FFFFFF';
const IONICON_FAMILY = 'ionicons';
/** How far each icon drifts along its ring (degrees). */
const RING_SWING_DEG = [16, 13, 10] as const;
/** One full back-and-forth along the arc (ms). */
const RING_SWING_MS = [5200, 4600, 4000] as const;

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

function getRingIcons(ringIndex: 0 | 1 | 2) {
  const entries = ORBIT_ICONS.map((icon, globalIndex) => ({ icon, globalIndex })).filter(
    ({ icon }) => icon.ring === ringIndex,
  );
  return {
    icons: entries.map((entry) => entry.icon),
    globalIndices: entries.map((entry) => entry.globalIndex),
  };
}

function AnimatedRingStroke({
  icons,
  angles,
  center,
  radius,
  scale,
  stroke,
  strokeWidth,
}: {
  icons: OrbitIcon[];
  angles: SharedValue<number>[];
  center: number;
  radius: number;
  scale: number;
  stroke: string;
  strokeWidth: number;
}) {
  const animatedProps = useAnimatedProps(() => {
    'worklet';
    const iconsWithAngles: { angle: number; iconSize: number }[] = [];
    for (let i = 0; i < icons.length; i += 1) {
      iconsWithAngles.push({
        angle: angles[i].value,
        iconSize: icons[i].iconSize,
      });
    }

    const cx = center;
    const cy = center;
    let d = '';
    if (iconsWithAngles.length > 0) {
      const gaps: { gapEnd: number; gapStart: number; sortKey: number }[] = [];
      for (let i = 0; i < iconsWithAngles.length; i += 1) {
        const icon = iconsWithAngles[i];
        const half = (icon.iconSize * scale) / 2 + 0.5;
        const span = (((Math.asin(Math.min(1, half / radius)) * 180) / Math.PI) * 2) * 0.82;
        const gapStart = icon.angle - span / 2;
        gaps.push({
          gapStart,
          gapEnd: icon.angle + span / 2,
          sortKey: ((gapStart % 360) + 360) % 360,
        });
      }

      for (let i = 1; i < gaps.length; i += 1) {
        const current = gaps[i];
        let j = i - 1;
        while (j >= 0 && gaps[j].sortKey > current.sortKey) {
          gaps[j + 1] = gaps[j];
          j -= 1;
        }
        gaps[j + 1] = current;
      }

      for (let i = 0; i < gaps.length; i += 1) {
        const cur = gaps[i];
        const next = gaps[(i + 1) % gaps.length];
        const start = ((cur.gapEnd % 360) + 360) % 360;
        const end = ((next.gapStart % 360) + 360) % 360;

        if (end <= start) {
          let continued = false;
          if (360 - start > 0.05) {
            const startRad = (start * Math.PI) / 180;
            const endRad = (360 * Math.PI) / 180;
            const sx = cx + Math.cos(startRad) * radius;
            const sy = cy + Math.sin(startRad) * radius;
            const ex = cx + Math.cos(endRad) * radius;
            const ey = cy + Math.sin(endRad) * radius;
            const sweep = 360 - start;
            const largeArc = sweep > 180 ? 1 : 0;
            d += `M ${sx} ${sy} A ${radius} ${radius} 0 ${largeArc} 1 ${ex} ${ey}`;
            continued = true;
          }
          if (end > 0.05) {
            const startRad = 0;
            const endRad = (end * Math.PI) / 180;
            const sx = cx + Math.cos(startRad) * radius;
            const sy = cy + Math.sin(startRad) * radius;
            const ex = cx + Math.cos(endRad) * radius;
            const ey = cy + Math.sin(endRad) * radius;
            const sweep = end;
            const largeArc = sweep > 180 ? 1 : 0;
            if (continued) {
              d += ` A ${radius} ${radius} 0 ${largeArc} 1 ${ex} ${ey}`;
            } else {
              d += `M ${sx} ${sy} A ${radius} ${radius} 0 ${largeArc} 1 ${ex} ${ey}`;
            }
          }
        } else if (end - start > 0.05) {
          const startRad = (start * Math.PI) / 180;
          const endRad = (end * Math.PI) / 180;
          const sx = cx + Math.cos(startRad) * radius;
          const sy = cy + Math.sin(startRad) * radius;
          const ex = cx + Math.cos(endRad) * radius;
          const ey = cy + Math.sin(endRad) * radius;
          const sweep = end - start;
          const largeArc = sweep > 180 ? 1 : 0;
          d += `M ${sx} ${sy} A ${radius} ${radius} 0 ${largeArc} 1 ${ex} ${ey}`;
        }
      }
    }

    return { d: d || `M ${center} ${center}`, opacity: d ? 1 : 0 };
  });

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      stroke={stroke}
      strokeWidth={strokeWidth}
      fill="none"
      strokeLinecap="butt"
    />
  );
}

function startOrbitSwing(angle: SharedValue<number>, item: OrbitIcon, phaseDelay: number) {
  const swing = RING_SWING_DEG[item.ring];
  const duration = RING_SWING_MS[item.ring];
  const easing = Easing.inOut(Easing.sin);
  angle.value = withDelay(
    phaseDelay,
    withRepeat(
      withSequence(
        withTiming(item.angle + swing, { duration: duration / 2, easing }),
        withTiming(item.angle - swing, { duration: duration / 2, easing }),
      ),
      -1,
      true,
    ),
  );
}

function useOrbitRingAngles(ringIndex: 0 | 1 | 2) {
  const { icons, globalIndices } = getRingIcons(ringIndex);
  const anglesRef = useRef<SharedValue<number>[] | null>(null);
  if (!anglesRef.current) {
    anglesRef.current = icons.map((icon) => makeMutable(icon.angle));
  }
  const angles = anglesRef.current;

  useEffect(() => {
    icons.forEach((icon, i) => {
      startOrbitSwing(angles[i], icon, globalIndices[i] * 180);
    });
  }, [angles, globalIndices, icons]);

  return { icons, angles };
}

function AnimatedOrbitBadge({
  item,
  angle,
  center,
  radius,
  scale,
}: {
  item: OrbitIcon;
  angle: SharedValue<number>;
  center: number;
  radius: number;
  scale: number;
}) {
  const iconSize = item.iconSize * scale;
  const half = iconSize / 2;

  const style = useAnimatedStyle(() => {
    const rad = (angle.value * Math.PI) / 180;
    const x = Math.cos(rad) * radius;
    const y = Math.sin(rad) * radius;
    return {
      left: center + x - half,
      top: center + y - half,
    };
  });

  return (
    <Animated.View
      style={[
        styles.marker,
        {
          width: iconSize,
          height: iconSize,
        },
        style,
      ]}>
      <Ionicons name={item.name} size={iconSize} color={ICON_COLOR} />
    </Animated.View>
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

  const ring0 = useOrbitRingAngles(0);
  const ring1 = useOrbitRingAngles(1);
  const ring2 = useOrbitRingAngles(2);
  const rings = [
    { ringIndex: 0 as const, ...ring0, radius: ringRadii[0] },
    { ringIndex: 1 as const, ...ring1, radius: ringRadii[1] },
    { ringIndex: 2 as const, ...ring2, radius: ringRadii[2] },
  ];

  if (!iconsReady) {
    return <View style={[styles.wrap, { width: wrapSize, height: wrapSize }]} />;
  }

  return (
    <View style={[styles.wrap, { width: wrapSize, height: wrapSize }]}>
      <Svg width={wrapSize} height={wrapSize} style={StyleSheet.absoluteFill}>
        {rings.map(({ ringIndex, icons, angles, radius }) => (
          <AnimatedRingStroke
            key={`ring-${ringIndex}-stroke`}
            icons={icons}
            angles={angles}
            center={center}
            radius={radius}
            scale={scale}
            stroke={ringStroke}
            strokeWidth={strokeWidth}
          />
        ))}
      </Svg>

      {rings.map(({ ringIndex, icons, angles, radius }) =>
        icons.map((icon, i) => (
          <AnimatedOrbitBadge
            key={`ring-${ringIndex}-icon-${icon.name}`}
            item={icon}
            angle={angles[i]}
            center={center}
            radius={radius}
            scale={scale}
          />
        )),
      )}

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
