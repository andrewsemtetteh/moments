import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

/**
 * The onboarding cast: soft blob characters drawn as vectors (crisp at any
 * size, theme-proof since they carry their own colours and outline). Each
 * screen gets one so the flow feels warm, like the welcome animation.
 */

const INK = '#1A1A1A';

/**
 * Brings an illustration to life: it pops in, then floats gently up and down
 * with a slight sway. Holds still when the system asks for reduced motion.
 */
export function FloatingArt({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  const reduceMotion = useReducedMotion();
  const t = useSharedValue(0);
  const enter = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    enter.value = withDelay(delay, withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.6)) }));
    const ease = Easing.inOut(Easing.sin);
    t.value = withDelay(
      delay + 420,
      withRepeat(
        withSequence(withTiming(1, { duration: 1600, easing: ease }), withTiming(0, { duration: 1600, easing: ease })),
        -1,
      ),
    );
  }, [reduceMotion, delay, enter, t]);

  const style = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [
      { translateY: -6 * t.value + (1 - enter.value) * 14 },
      { rotate: `${(t.value - 0.5) * 3}deg` },
      { scale: 0.92 + 0.08 * enter.value },
    ],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/**
 * The couple: coral and lavender, holding hands under a heart. They blink, the
 * heart beats, and they glance at each other now and then. `waiting` draws the
 * second as a dotted outline that breathes, while the first keeps looking over
 * to see if they've arrived.
 */
export function CoupleCharacters({ width = 220, waiting = false }: { width?: number; waiting?: boolean }) {
  const h = (width * 140) / 220;
  const k = width / 220;
  const reduceMotion = useReducedMotion();
  const blinkA = useBlink(0);
  const blinkB = useBlink(3);
  const lookA = useWander(1, 2.4);
  const lookB = useWander(4, 2.4);
  const heart = useHeartbeat(300);
  const ghost = useSharedValue(1);
  useEffect(() => {
    if (!waiting || reduceMotion) return;
    ghost.value = withRepeat(withSequence(withTiming(0.7, { duration: 1600 }), withTiming(1, { duration: 1600 })), -1);
  }, [waiting, reduceMotion, ghost]);
  const ghostStyle = useAnimatedStyle(() => ({ opacity: ghost.value }));

  return (
    <View style={{ width, height: h }}>
      <Svg width={width} height={h} viewBox="0 0 220 140">
        <Path d="M22 122 C12 84 26 42 64 40 C102 38 116 78 108 122 Z" fill="#FF8A65" stroke={INK} strokeWidth={3} />
        <BlinkEye cx={52} cy={78} r={10} blink={blinkA} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
        <BlinkEye cx={waiting ? 56 : 54} cy={79} r={4.5} blink={blinkA} lookX={lookA} />
        <BlinkEye cx={80} cy={78} r={10} blink={blinkA} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
        <BlinkEye cx={waiting ? 84 : 82} cy={79} r={4.5} blink={blinkA} lookX={lookA} />
        <Path d="M58 98 Q66 105 74 98" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        {waiting ? (
          <Path d="M104 70 l14 -18" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        ) : (
          <>
            <Path
              d="M114 122 C108 72 132 36 166 38 C200 40 210 82 198 122 Z"
              fill="#8C7CF0"
              stroke={INK}
              strokeWidth={3}
            />
            <BlinkEye cx={146} cy={76} r={10} blink={blinkB} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
            <BlinkEye cx={144} cy={77} r={4.5} blink={blinkB} lookX={lookB} />
            <BlinkEye cx={174} cy={76} r={10} blink={blinkB} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
            <BlinkEye cx={172} cy={77} r={4.5} blink={blinkB} lookX={lookB} />
            <Path d="M150 96 Q158 103 166 96" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
            <Path d="M104 104 Q111 96 120 104" fill="none" stroke={INK} strokeWidth={4} strokeLinecap="round" />
          </>
        )}
      </Svg>
      {waiting ? (
        // The empty spot breathes: someone's on the way.
        <Part scale={k} box={[104, 34, 106, 92]} style={ghostStyle}>
          <Path
            d="M114 122 C108 72 132 36 166 38 C200 40 210 82 198 122 Z"
            fill="#FFFFFF"
            stroke={INK}
            strokeWidth={3}
            strokeDasharray="7 7"
          />
          <Path d="M156 80 h20 M166 70 v20" stroke={INK} strokeWidth={4} strokeLinecap="round" />
        </Part>
      ) : (
        <Part scale={k} box={[96, 18, 34, 28]} style={heart}>
          <Path
            d="M100 26 c0-8 11-11 13-3 c2-8 13-5 13 3 c0 9-13 16-13 16 s-13-7-13-16z"
            fill="#FF5A6E"
            stroke={INK}
            strokeWidth={2.5}
          />
        </Part>
      )}
    </View>
  );
}

const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/* ── Shared motion for the cast ─────────────────────────────────────────── */

/** A blink every few seconds; `seed` keeps characters on different rhythms. */
function useBlink(seed = 0) {
  const reduceMotion = useReducedMotion();
  const blink = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    blink.value = withRepeat(
      withSequence(
        withDelay(2200 + ((seed * 730) % 1800), withTiming(0.1, { duration: 70 })),
        withTiming(1, { duration: 110 }),
      ),
      -1,
    );
  }, [reduceMotion, seed, blink]);
  return blink;
}

/** A slow look around: left, centre, right, centre. */
function useWander(seed = 0, amount = 1) {
  const reduceMotion = useReducedMotion();
  const look = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    const glide = { duration: 300, easing: Easing.out(Easing.quad) };
    look.value = withDelay(
      (seed * 300) % 1200,
      withRepeat(
        withSequence(
          withTiming(-amount, glide),
          withDelay(900, withTiming(0, glide)),
          withDelay(900, withTiming(amount, glide)),
          withDelay(900, withTiming(0, glide)),
          withDelay(1400, withTiming(0, glide)),
        ),
        -1,
      ),
    );
  }, [reduceMotion, seed, amount, look]);
  return look;
}

/** A heartbeat: two quick beats, then a rest. */
function useHeartbeat(delay = 0) {
  const reduceMotion = useReducedMotion();
  const beat = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    beat.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.24, { duration: 130 }),
          withTiming(1, { duration: 150 }),
          withTiming(1.16, { duration: 120 }),
          withTiming(1, { duration: 220 }),
          withDelay(1100, withTiming(1, { duration: 0 })),
        ),
        -1,
      ),
    );
  }, [reduceMotion, delay, beat]);
  return useAnimatedStyle(() => ({ transform: [{ scale: beat.value }] }));
}

/** An eye (white or pupil) that blinks and can slide sideways/up and down. */
function BlinkEye({
  cx,
  cy,
  r,
  blink,
  lookX,
  lookY,
  fill = INK,
  stroke,
  strokeWidth,
}: {
  cx: number;
  cy: number;
  r: number;
  blink: SharedValue<number>;
  lookX?: SharedValue<number>;
  lookY?: SharedValue<number>;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
}) {
  const props = useAnimatedProps(() => ({
    cx: cx + (lookX ? lookX.value : 0),
    cy: cy + (lookY ? lookY.value : 0),
    ry: r * blink.value,
  }));
  return (
    <AnimatedEllipse
      cx={cx}
      cy={cy}
      rx={r}
      animatedProps={props}
      fill={fill}
      stroke={stroke}
      strokeWidth={strokeWidth}
    />
  );
}

/**
 * A piece of a drawing that moves on its own (a heart, a sparkle): cut from the
 * same viewBox and laid exactly over the drawing, so it can scale or fade in place.
 */
function Part({
  scale,
  box,
  style,
  children,
}: {
  /** Pixels per viewBox unit. */
  scale: number;
  /** [x, y, width, height] in viewBox units. */
  box: [number, number, number, number];
  style?: object;
  children: ReactNode;
}) {
  const [x, y, w, h] = box;
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', left: x * scale, top: y * scale, width: w * scale, height: h * scale }, style]}>
      <Svg width={w * scale} height={h * scale} viewBox={`${x} ${y} ${w} ${h}`}>
        {children}
      </Svg>
    </Animated.View>
  );
}

/** Where a peeking character should look: -1, 0 or 1 on each axis (left/up is -1). */
export type LookAt = { x: number; y: number };

/**
 * One small character peeking up from the bottom of a card. It's alive:
 * the eyes wander and blink on their own rhythm (`seed` keeps neighbours out
 * of step), glance toward `lookAt` (whatever was just picked), and when it's
 * picked itself (`happy`) it hops, smiles and looks up at you.
 */
export function PeekCharacter({
  color,
  size = 64,
  happy = false,
  seed = 0,
  lookAt = null,
}: {
  color: string;
  size?: number;
  happy?: boolean;
  seed?: number;
  lookAt?: LookAt | null;
}) {
  const reduceMotion = useReducedMotion();
  const lookX = useSharedValue(0);
  const lookY = useSharedValue(0);
  const blink = useSharedValue(1);
  const hop = useSharedValue(0);

  // Blinking never stops (it's what makes them feel alive).
  useEffect(() => {
    if (reduceMotion) return;
    blink.value = withRepeat(
      withSequence(
        withDelay(2400 + ((seed * 730) % 1800), withTiming(0.1, { duration: 70 })),
        withTiming(1, { duration: 110 }),
      ),
      -1,
    );
  }, [reduceMotion, seed, blink]);

  // Eyes: up at you when picked, toward the pick when there is one, otherwise wandering.
  const lookAtX = lookAt?.x ?? null;
  const lookAtY = lookAt?.y ?? null;
  useEffect(() => {
    if (reduceMotion) {
      lookX.value = 0;
      lookY.value = happy ? -1 : 0;
      return;
    }
    const glide = { duration: 260, easing: Easing.out(Easing.quad) };
    if (happy) {
      lookX.value = withTiming(0, glide);
      lookY.value = withTiming(-1, glide);
      return;
    }
    if (lookAtX !== null && lookAtY !== null) {
      lookX.value = withTiming(lookAtX, glide);
      lookY.value = withTiming(lookAtY, glide);
      return;
    }
    const wait = 700 + ((seed * 410) % 900);
    lookY.value = withTiming(0, glide);
    lookX.value = withDelay(
      (seed * 260) % 1200,
      withRepeat(
        withSequence(
          withTiming(-1, glide),
          withDelay(wait, withTiming(0, glide)),
          withDelay(wait, withTiming(1, glide)),
          withDelay(wait, withTiming(0, glide)),
          withDelay(wait, withTiming(0, glide)),
        ),
        -1,
      ),
    );
  }, [reduceMotion, happy, lookAtX, lookAtY, seed, lookX, lookY]);

  // A little hop of joy when picked.
  useEffect(() => {
    if (!happy || reduceMotion) return;
    hop.value = withSequence(
      withTiming(-7, { duration: 140, easing: Easing.out(Easing.quad) }),
      withSpring(0, { damping: 7 }),
    );
  }, [happy, reduceMotion, hop]);

  const bodyStyle = useAnimatedStyle(() => ({ transform: [{ translateY: hop.value }] }));
  // Both eyes share one blink; pupils slide up to ~2px inside the eye.
  const eyeWhite = useAnimatedProps(() => ({ ry: 5 * blink.value }));
  const leftPupil = useAnimatedProps(() => ({
    cx: 25 + lookX.value * 2.2,
    cy: 29 + lookY.value * 2,
    ry: 2.3 * blink.value,
  }));
  const rightPupil = useAnimatedProps(() => ({
    cx: 40 + lookX.value * 2.2,
    cy: 29 + lookY.value * 2,
    ry: 2.3 * blink.value,
  }));

  return (
    <Animated.View style={bodyStyle}>
      <Svg width={size} height={(size * 52) / 62} viewBox="0 0 62 52">
        <Path d="M6 54 C2 28 14 8 31 8 C48 8 60 28 56 54 Z" fill={color} stroke={INK} strokeWidth={2.5} />
        <AnimatedEllipse cx={24} cy={28} rx={5} animatedProps={eyeWhite} fill="#FFFFFF" stroke={INK} strokeWidth={2} />
        <AnimatedEllipse cx={25} cy={29} rx={2.3} animatedProps={leftPupil} fill={INK} />
        <AnimatedEllipse cx={39} cy={28} rx={5} animatedProps={eyeWhite} fill="#FFFFFF" stroke={INK} strokeWidth={2} />
        <AnimatedEllipse cx={40} cy={29} rx={2.3} animatedProps={rightPupil} fill={INK} />
        {happy ? (
          <>
            <Path d="M25 38 Q31 45 37 38" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
            {/* Rosy cheeks when picked. */}
            <Circle cx={17} cy={36} r={3} fill="#FF7A8A" opacity={0.55} />
            <Circle cx={46} cy={36} r={3} fill="#FF7A8A" opacity={0.55} />
          </>
        ) : (
          <Path d="M29 39 Q31 37 33 39" fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
        )}
      </Svg>
    </Animated.View>
  );
}

/** A calendar with a face: it blinks and its heart beats. */
export function CalendarCharacter({ size = 76 }: { size?: number }) {
  const k = size / 76;
  const blink = useBlink(2);
  const heart = useHeartbeat(0);

  return (
    <View style={{ width: size, height: (size * 70) / 76 }}>
      <Svg width={size} height={(size * 70) / 76} viewBox="0 0 76 70">
        <Rect x={8} y={14} width={56} height={50} rx={12} fill="#FFD25E" stroke={INK} strokeWidth={2.5} />
        <Path d="M8 28h56" stroke={INK} strokeWidth={2.5} />
        <Path d="M22 8v12M50 8v12" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        <BlinkEye cx={28} cy={42} r={3.5} blink={blink} />
        <BlinkEye cx={44} cy={42} r={3.5} blink={blink} />
        <Path d="M30 51 Q36 56 42 51" fill="none" stroke={INK} strokeWidth={2.5} strokeLinecap="round" />
      </Svg>
      <Part scale={k} box={[57, 0, 19, 16]} style={heart}>
        <Path d="M60 4 c0-4 6-6 7-1 c1-5 7-3 7 1 c0 5-7 8-7 8 s-7-3-7-8z" fill="#FF5A6E" stroke={INK} strokeWidth={2} />
      </Part>
    </View>
  );
}

/** A bell that rings: it swings from the top every few seconds, the sound lines flash, and it blinks. */
export function BellCharacter({ size = 96 }: { size?: number }) {
  const k = size / 110;
  const reduceMotion = useReducedMotion();
  const blink = useBlink(1);
  const swing = useSharedValue(0);
  const sound = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) return;
    const t = (deg: number) => withTiming(deg, { duration: 90, easing: Easing.inOut(Easing.quad) });
    swing.value = withRepeat(withSequence(withDelay(1400, t(16)), t(-14), t(11), t(-8), t(5), t(-2), t(0)), -1);
    sound.value = withRepeat(
      withSequence(withDelay(1400, withTiming(1, { duration: 90 })), withDelay(450, withTiming(0, { duration: 250 }))),
      -1,
    );
  }, [reduceMotion, swing, sound]);
  const bellStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${swing.value}deg` }] }));
  const soundStyle = useAnimatedStyle(() => ({ opacity: sound.value }));

  return (
    <View style={{ width: size, height: (size * 96) / 110 }}>
      {/* Swings from the top, like a real bell. */}
      <Animated.View style={[{ transformOrigin: '50% 22%' }, bellStyle]}>
        <Svg width={size} height={(size * 96) / 110} viewBox="0 0 110 96">
          <Path
            d="M30 70 V46 a25 25 0 0 1 50 0 V70 l8 10 H22 z"
            fill="#FFD25E"
            stroke={INK}
            strokeWidth={3}
            strokeLinejoin="round"
          />
          <Path d="M47 86 a8 8 0 0 0 16 0" fill="#FFD25E" stroke={INK} strokeWidth={3} />
          <BlinkEye cx={46} cy={52} r={4} blink={blink} />
          <BlinkEye cx={64} cy={52} r={4} blink={blink} />
          <Path d="M48 62 Q55 68 62 62" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        </Svg>
      </Animated.View>
      <Part scale={k} box={[0, 18, 110, 32]} style={soundStyle}>
        <Path d="M14 30 l-8 -6 M12 44 h-9 M96 30 l8 -6 M98 44 h9" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      </Part>
    </View>
  );
}

/**
 * A friendly shield: it looks around and blinks, a soft glow breathes behind
 * it, and two sparkles twinkle (here to keep things safe, not to watch you).
 */
export function ShieldCharacter({ size = 120 }: { size?: number }) {
  const k = size / 130;
  const reduceMotion = useReducedMotion();
  const blink = useBlink(5);
  const lookX = useWander(2, 3);
  const glow = useSharedValue(0);
  const twinkle = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    const ease = Easing.inOut(Easing.sin);
    glow.value = withRepeat(
      withSequence(withTiming(1, { duration: 1400, easing: ease }), withTiming(0, { duration: 1400, easing: ease })),
      -1,
    );
    twinkle.value = withRepeat(
      withSequence(withTiming(1, { duration: 700, easing: ease }), withTiming(0, { duration: 700, easing: ease })),
      -1,
    );
  }, [reduceMotion, glow, twinkle]);
  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.18 + glow.value * 0.22,
    transform: [{ scale: 0.9 + glow.value * 0.12 }],
  }));
  const sparkA = useAnimatedStyle(() => ({
    opacity: twinkle.value,
    transform: [{ scale: 0.5 + twinkle.value * 0.6 }],
  }));
  const sparkB = useAnimatedStyle(() => ({
    opacity: 1 - twinkle.value,
    transform: [{ scale: 1.1 - twinkle.value * 0.6 }],
  }));
  const sparkle = (cx: number, cy: number) => (
    <Path
      d={`M${cx} ${cy - 8} Q${cx} ${cy} ${cx + 8} ${cy} Q${cx} ${cy} ${cx} ${cy + 8} Q${cx} ${cy} ${cx - 8} ${cy} Q${cx} ${cy} ${cx} ${cy - 8} Z`}
      fill="#FFD25E"
      stroke={INK}
      strokeWidth={2}
      strokeLinejoin="round"
    />
  );

  return (
    <View style={{ width: size, height: (size * 120) / 130 }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            left: 18 * k,
            top: 10 * k,
            width: 94 * k,
            height: 104 * k,
            borderRadius: 60 * k,
            backgroundColor: '#7FD3A8',
          },
          glowStyle,
        ]}
      />
      <Svg width={size} height={(size * 120) / 130} viewBox="0 0 130 120">
        <Path
          d="M65 8 L112 26 V58 C112 88 92 106 65 114 C38 106 18 88 18 58 V26 Z"
          fill="#7FD3A8"
          stroke={INK}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        <BlinkEye cx={52} cy={56} r={8} blink={blink} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
        <BlinkEye cx={53} cy={57} r={3.5} blink={blink} lookX={lookX} />
        <BlinkEye cx={78} cy={56} r={8} blink={blink} fill="#FFFFFF" stroke={INK} strokeWidth={2.5} />
        <BlinkEye cx={79} cy={57} r={3.5} blink={blink} lookX={lookX} />
        <Path d="M55 74 Q65 82 75 74" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      </Svg>
      <Part scale={k} box={[2, 4, 22, 22]} style={sparkA}>
        {sparkle(13, 15)}
      </Part>
      <Part scale={k} box={[106, 0, 22, 22]} style={sparkB}>
        {sparkle(117, 11)}
      </Part>
    </View>
  );
}

export function CameraCharacter({ size = 140 }: { size?: number }) {
  return (
    <Svg width={size} height={(size * 110) / 150} viewBox="0 0 150 110">
      <Rect x={20} y={30} width={110} height={72} rx={18} fill="#FF8A65" stroke={INK} strokeWidth={3} />
      <Rect x={52} y={18} width={40} height={18} rx={6} fill="#FF8A65" stroke={INK} strokeWidth={3} />
      <Circle cx={75} cy={66} r={22} fill="#FFFFFF" stroke={INK} strokeWidth={3} />
      <Circle cx={68} cy={62} r={4} fill={INK} />
      <Circle cx={82} cy={62} r={4} fill={INK} />
      <Path d="M68 73 Q75 79 82 73" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

export function MicCharacter({ size = 120 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Rect x={38} y={10} width={44} height={66} rx={22} fill="#8C7CF0" stroke={INK} strokeWidth={3} />
      <Path d="M26 56 a34 34 0 0 0 68 0" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <Path d="M60 90 v18 M44 110 h32" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <Circle cx={52} cy={40} r={4} fill={INK} />
      <Circle cx={68} cy={40} r={4} fill={INK} />
      <Path d="M52 52 Q60 58 68 52" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

export function PinCharacter({ size = 110 }: { size?: number }) {
  return (
    <Svg width={size} height={(size * 120) / 110} viewBox="0 0 110 120">
      <Path
        d="M55 112 C30 84 14 64 14 44 a41 41 0 0 1 82 0 c0 20 -16 40 -41 68 z"
        fill="#7FD3A8"
        stroke={INK}
        strokeWidth={3}
      />
      <Circle cx={44} cy={44} r={5} fill={INK} />
      <Circle cx={66} cy={44} r={5} fill={INK} />
      <Path d="M45 58 Q55 66 65 58" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

export function PhotosCharacter({ size = 130 }: { size?: number }) {
  return (
    <Svg width={size} height={(size * 110) / 130} viewBox="0 0 130 110">
      <Rect
        x={30}
        y={10}
        width={80}
        height={70}
        rx={14}
        fill="#FFD25E"
        stroke={INK}
        strokeWidth={3}
        transform="rotate(8 70 45)"
      />
      <Rect x={18} y={26} width={84} height={74} rx={14} fill="#9AD0F5" stroke={INK} strokeWidth={3} />
      <Circle cx={46} cy={58} r={4.5} fill={INK} />
      <Circle cx={74} cy={58} r={4.5} fill={INK} />
      <Path d="M50 72 Q60 80 70 72" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

/** A smile that moves: it widens and relaxes as if chatting. */
function ChatMouth({ x, y, w = 12, seed = 0 }: { x: number; y: number; w?: number; seed?: number }) {
  const reduceMotion = useReducedMotion();
  const open = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    const ease = Easing.inOut(Easing.quad);
    open.value = withDelay(
      (seed * 450) % 1600,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 220, easing: ease }),
          withTiming(0.3, { duration: 200, easing: ease }),
          withTiming(0.9, { duration: 220, easing: ease }),
          withTiming(0, { duration: 260, easing: ease }),
          withDelay(1400 + ((seed * 330) % 900), withTiming(0, { duration: 0 })),
        ),
        -1,
      ),
    );
  }, [reduceMotion, seed, open]);
  const props = useAnimatedProps(() => {
    const depth = 3 + open.value * 4;
    return { d: `M${x - w / 2} ${y} Q${x} ${y + depth} ${x + w / 2} ${y}` };
  });
  return (
    <AnimatedPath
      d={`M${x - w / 2} ${y} Q${x} ${y + 3} ${x + w / 2} ${y}`}
      animatedProps={props}
      fill="none"
      stroke={INK}
      strokeWidth={3}
      strokeLinecap="round"
    />
  );
}

/** One of the four: blinking, looking around and chatting, each on its own rhythm. */
function Chatter({ x1, x2, y, seed }: { x1: number; x2: number; y: number; seed: number }) {
  const blink = useBlink(seed);
  const look = useWander(seed, 2);
  return (
    <>
      <BlinkEye cx={x1} cy={y} r={5} blink={blink} lookX={look} />
      <BlinkEye cx={x2} cy={y} r={5} blink={blink} lookX={look} />
      <ChatMouth x={(x1 + x2) / 2} y={y + 13} seed={seed} />
    </>
  );
}

/** A group of four, for "invite another couple": they blink, look around and chat. */
export function TwoCouplesCharacters({ width = 300 }: { width?: number }) {
  const h = (width * 130) / 300;
  const blob = (d: string, fill: string) => <Path d={d} fill={fill} stroke={INK} strokeWidth={3} />;
  return (
    <Svg width={width} height={h} viewBox="0 0 300 130">
      {blob('M14 120 C8 90 18 58 46 56 C74 54 84 86 78 120 Z', '#FF8A65')}
      <Chatter x1={38} x2={56} y={86} seed={0} />
      {blob('M80 120 C76 84 92 60 116 62 C140 64 148 92 140 120 Z', '#8C7CF0')}
      <Chatter x1={104} x2={122} y={90} seed={3} />
      {blob('M160 120 C154 88 166 60 192 60 C218 60 228 90 222 120 Z', '#7FD3A8')}
      <Chatter x1={184} x2={202} y={90} seed={1} />
      {blob('M224 120 C220 86 236 56 262 58 C288 60 296 92 288 120 Z', '#FFD25E')}
      <Chatter x1={250} x2={268} y={88} seed={4} />
      <Path
        d="M144 18 c0-6 8-8 10-2 c2-6 10-4 10 2 c0 7-10 12-10 12 s-10-5-10-12z"
        fill="#FF5A6E"
        stroke={INK}
        strokeWidth={2.5}
      />
    </Svg>
  );
}

/** A smiling envelope with a heart (check your email). */
export function EnvelopeCharacter({ size = 170 }: { size?: number }) {
  return (
    <Svg width={size} height={(size * 130) / 180} viewBox="0 0 180 130">
      <Rect x={22} y={30} width={136} height={88} rx={18} fill="#FFE7A0" stroke={INK} strokeWidth={3} />
      <Path d="M24 38 L90 84 L156 38" fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <Circle cx={74} cy={98} r={5} fill={INK} />
      <Circle cx={106} cy={98} r={5} fill={INK} />
      <Path d="M82 108 Q90 114 98 108" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      <Path
        d="M140 18 c0-6 8-8 10-2 c2-6 10-4 10 2 c0 7-10 12-10 12 s-10-5-10-12z"
        fill="#FF5A6E"
        stroke={INK}
        strokeWidth={2.5}
      />
    </Svg>
  );
}
