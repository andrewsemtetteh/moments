import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Path, Stop, LinearGradient as SvgGradient } from 'react-native-svg';

import { Icon, type IconName } from '@/components/ui/Icon';
import { colorWithAlpha } from '@/components/ui/primitives';
import type { IntroSlideId } from '@/constants/intro-slides';
import { useTheme } from '@/hooks/useTheme';

type Props = {
  slideId: IntroSlideId;
  icons: IconName[];
};

function MiniHeart({ x, y, size, opacity }: { x: number; y: number; size: number; opacity: number }) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute', left: x, top: y, opacity }}>
      <Path
        d="M50 84C30 70 16 58 16 42c0-11 8-19 18-19 7 0 12 4 16 9 4-5 9-9 16-9 10 0 18 8 18 19 0 16-14 28-34 42Z"
        fill={colors.accent}
      />
    </Svg>
  );
}

function SlideScene({ slideId, icons }: Props) {
  const { colors } = useTheme();

  const cardStyle = {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    shadowColor: colors.shadow,
  };

  if (slideId === 'moments') {
    return (
      <View style={styles.scene}>
        <View style={[styles.photoCard, cardStyle, styles.photoBack]}>
          <LinearGradient colors={colors.gradient} style={styles.photoFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
          <View style={[styles.photoBadge, { backgroundColor: colors.accentSoft }]}>
            <Icon name="camera" size={16} color={colors.accent} />
          </View>
        </View>
        <View style={[styles.photoCard, cardStyle, styles.photoFront]}>
          <View style={[styles.momentStrip, { backgroundColor: colorWithAlpha(colors.accent, 0.12) }]}>
            <Icon name={icons[0]} size={22} color={colors.accent} />
            <Icon name={icons[1]} size={22} color={colors.gradient[1]} />
            <Icon name={icons[2]} size={22} color={colors.accent} />
          </View>
        </View>
        <MiniHeart x={18} y={24} size={28} opacity={0.5} />
        <MiniHeart x={200} y={140} size={22} opacity={0.35} />
      </View>
    );
  }

  if (slideId === 'connection') {
    return (
      <View style={styles.scene}>
        <View style={[styles.chatRow, styles.chatLeft, cardStyle]}>
          <View style={[styles.bubble, { backgroundColor: colors.surface }]}>
            <Icon name="heart" size={18} color={colors.accent} />
          </View>
        </View>
        <View style={[styles.chatRow, styles.chatRight]}>
          <LinearGradient colors={colors.gradient} style={styles.bubbleAccent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            <Icon name="fire" size={18} color={colors.onAccent} />
          </LinearGradient>
        </View>
        <View style={[styles.streakPill, { backgroundColor: colors.accentSoft, borderColor: colors.border }]}>
          <Icon name="fire" size={16} color={colors.accent} />
          <View style={[styles.streakDot, { backgroundColor: colors.accent }]} />
        </View>
        <View style={[styles.moodOrbit, cardStyle]}>
          {icons.map((icon) => (
            <View key={icon} style={[styles.moodChip, { backgroundColor: colors.accentSoft }]}>
              <Icon name={icon} size={16} color={colors.accent} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (slideId === 'together') {
    return (
      <View style={styles.scene}>
        <View style={[styles.calendarCard, cardStyle]}>
          <View style={styles.calendarHeader}>
            <Icon name="calendar" size={18} color={colors.accent} />
          </View>
          <View style={styles.calendarGrid}>
            {Array.from({ length: 12 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.calendarCell,
                  i === 5 ? { backgroundColor: colors.accent } : { backgroundColor: colors.accentSoft },
                ]}
              />
            ))}
          </View>
        </View>
        <View style={[styles.activityChip, cardStyle, { top: 28, right: 12 }]}>
          <Icon name="film" size={16} color={colors.accent} />
        </View>
        <View style={[styles.activityChip, cardStyle, { bottom: 36, left: 8 }]}>
          <Icon name="gift" size={16} color={colors.gradient[1]} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.scene}>
      <Svg width={220} height={200} viewBox="0 0 220 200">
        <Defs>
          <SvgGradient id="shield-grad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.gradient[0]} />
            <Stop offset="1" stopColor={colors.gradient[1]} />
          </SvgGradient>
        </Defs>
        <Circle cx="110" cy="96" r="72" fill={colorWithAlpha(colors.accent, 0.1)} />
        <Path
          d="M110 44c-28 14-48 18-48 42 0 36 22 58 48 74 26-16 48-38 48-74 0-24-20-28-48-42Z"
          fill="url(#shield-grad)"
          opacity={0.9}
        />
      </Svg>
      <View style={[styles.lockBadge, cardStyle]}>
        <Icon name="lock" size={20} color={colors.accent} />
      </View>
      <View style={[styles.pairDots, cardStyle]}>
        <View style={[styles.avatarDot, { backgroundColor: colors.gradient[0], borderColor: colors.surfaceElevated }]} />
        <View
          style={[
            styles.avatarDot,
            { backgroundColor: colors.gradient[1], borderColor: colors.surfaceElevated, marginLeft: -10 },
          ]}
        />
      </View>
    </View>
  );
}

export function IntroIllustration({ slideId, icons }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.frame, { borderColor: colors.border, backgroundColor: colorWithAlpha(colors.surface, 0.55) }]}>
      <SlideScene slideId={slideId} icons={icons} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: '100%',
    aspectRatio: 1.05,
    maxHeight: 280,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scene: {
    width: 240,
    height: 220,
    position: 'relative',
  },
  photoCard: {
    position: 'absolute',
    width: 132,
    height: 168,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  photoBack: { left: 16, top: 18, transform: [{ rotate: '-8deg' }] },
  photoFront: {
    right: 16,
    top: 42,
    transform: [{ rotate: '6deg' }],
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoFill: { flex: 1 },
  photoBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  momentStrip: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderRadius: 16,
  },
  chatRow: {
    position: 'absolute',
    padding: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chatLeft: { left: 8, top: 48 },
  chatRight: { right: 8, top: 96 },
  bubble: {
    width: 44,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubbleAccent: {
    width: 52,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakPill: {
    position: 'absolute',
    top: 16,
    alignSelf: 'center',
    left: '32%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  streakDot: { width: 8, height: 8, borderRadius: 4 },
  moodOrbit: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    left: '22%',
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  moodChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarCard: {
    position: 'absolute',
    left: 28,
    top: 24,
    width: 150,
    padding: 14,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  calendarHeader: { marginBottom: 10 },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  calendarCell: { width: 22, height: 22, borderRadius: 6 },
  activityChip: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  lockBadge: {
    position: 'absolute',
    top: 72,
    alignSelf: 'center',
    left: '42%',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  pairDots: {
    position: 'absolute',
    bottom: 28,
    alignSelf: 'center',
    left: '34%',
    flexDirection: 'row',
    padding: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  avatarDot: { width: 28, height: 28, borderRadius: 14, borderWidth: 2 },
});
