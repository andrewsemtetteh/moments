import * as Haptics from 'expo-haptics';
import { useEffect, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PLAY_TONES, type PlayTone } from '@/components/activities/explore/explore-catalog';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { useTheme } from '@/hooks/useTheme';
import { getGameDefinition, type LiveGameKind, type RoomState } from '@/lib/game-room/types';
import { useAuthStore, useRelationshipStore } from '@/stores';
import { useGameRoomStore } from '@/stores/game-room-store';

/** Darken (negative) or lighten (positive) a #rrggbb color. */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const channel = (shift: number) => {
    const c = (n >> shift) & 255;
    const next = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.max(0, Math.min(255, Math.round(next)));
  };
  return `#${[16, 8, 0].map((s) => channel(s).toString(16).padStart(2, '0')).join('')}`;
}

export function useGameTone(game: LiveGameKind): PlayTone {
  return PLAY_TONES[getGameDefinition(game).tone];
}

export function useRoomPlayers() {
  const user = useAuthStore((s) => s.user);
  const partner = useRelationshipStore((s) => s.partner);
  return {
    meId: user?.id ?? '',
    me: { id: user?.id ?? '', name: user?.name ?? 'You', avatar: user?.avatar_url ?? null },
    partner: { id: partner?.id ?? '', name: partner?.name ?? 'Partner', avatar: partner?.avatar_url ?? null },
  };
}

export function firstName(name: string | null | undefined) {
  return (name ?? '').trim().split(/\s+/)[0] || 'Partner';
}

/** Chunky 3D game button — presses down into its own shadow. */
export function ChunkyButton({
  label,
  onPress,
  color,
  textColor = '#FFFFFF',
  disabled,
  icon,
  style,
  compact,
}: {
  label: string;
  onPress: () => void;
  color: string;
  textColor?: string;
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  compact?: boolean;
}) {
  const depth = compact ? 3 : 5;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [
        styles.chunky,
        {
          backgroundColor: disabled ? shade(color, 0.45) : color,
          borderBottomColor: disabled ? shade(color, 0.2) : shade(color, -0.3),
          borderBottomWidth: pressed ? 1 : depth,
          marginTop: pressed ? depth - 1 : 0,
          marginBottom: pressed ? 0 : 0,
          paddingVertical: compact ? 11 : 16,
          opacity: disabled ? 0.7 : 1,
        },
        style,
      ]}>
      {icon}
      <Text style={[styles.chunkyText, { color: textColor, fontSize: compact ? 15 : 17 }]}>{label}</Text>
    </Pressable>
  );
}

/** Avatar + name + live score, ringed when it's that player's turn. */
export function PlayerChip({
  name,
  avatar,
  score,
  active,
  points,
  accent,
  align = 'left',
}: {
  name: string;
  avatar: string | null;
  score: number;
  active?: boolean;
  points?: number;
  accent: string;
  align?: 'left' | 'right';
}) {
  const { colors } = useTheme();
  const pop = useSharedValue(0);

  useEffect(() => {
    if (points && points > 0) {
      pop.value = 0;
      pop.value = withSequence(withSpring(1, { damping: 8, stiffness: 240 }), withDelay(900, withTiming(0, { duration: 250 })));
    }
  }, [points, pop]);

  const popStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ translateY: (1 - pop.value) * 8 }, { scale: 0.8 + pop.value * 0.3 }],
  }));

  return (
    <View style={[styles.chip, align === 'right' && styles.chipRight]}>
      <View style={[styles.chipRing, { borderColor: active ? accent : 'transparent' }]}>
        <Avatar name={name} imageUrl={avatar} size={40} />
      </View>
      <View style={{ alignItems: align === 'right' ? 'flex-end' : 'flex-start' }}>
        <Text style={[styles.chipName, { color: colors.textSecondary }]} numberOfLines={1}>
          {firstName(name)}
        </Text>
        <View style={styles.chipScoreRow}>
          <Text style={[styles.chipScore, { color: colors.text }]}>{score}</Text>
          <Animated.Text style={[styles.chipPop, { color: accent }, popStyle]}>
            {points ? `+${points}` : ''}
          </Animated.Text>
        </View>
      </View>
    </View>
  );
}

/** Round counter dots + the two scores. Team games show one shared score. */
export function ScoreHeader({ state, accent }: { state: RoomState; accent: string }) {
  const { colors } = useTheme();
  const { me, partner } = useRoomPlayers();
  const def = getGameDefinition(state.game);
  const total = state.totalRounds;
  const [p1, p2] = state.players;
  const mine = p1.id === me.id ? p1 : p2;
  const theirs = mine.id === p1.id ? p2 : p1;

  return (
    <View style={styles.scoreWrap}>
      <View style={styles.scoreRow}>
        <PlayerChip
          name={me.name}
          avatar={me.avatar}
          score={state.scores[mine.id] ?? 0}
          points={state.step === 'reveal' ? state.roundPoints[mine.id] : 0}
          active={state.turnId === mine.id}
          accent={accent}
        />
        <View style={styles.roundBox}>
          <Text style={[styles.roundNum, { color: colors.text }]}>
            {Math.min(state.round + 1, total)}
            <Text style={{ color: colors.textTertiary }}>/{total}</Text>
          </Text>
          {def.team && state.streak >= 2 ? (
            <Text style={[styles.streak, { color: accent }]}>🔥 {state.streak}</Text>
          ) : (
            <Text style={[styles.roundLabel, { color: colors.textTertiary }]}>ROUND</Text>
          )}
        </View>
        <PlayerChip
          name={partner.name}
          avatar={partner.avatar}
          score={state.scores[theirs.id] ?? 0}
          points={state.step === 'reveal' ? state.roundPoints[theirs.id] : 0}
          active={state.turnId === theirs.id}
          accent={accent}
          align="right"
        />
      </View>
      <View style={styles.dots}>
        {Array.from({ length: total }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                backgroundColor:
                  i < state.round || (i === state.round && state.step === 'reveal')
                    ? accent
                    : i === state.round
                      ? shade(accent, 0.45)
                      : colors.border,
                flex: 1,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const REACTIONS = ['❤️', '😂', '😮', '🔥', '👏', '😈'];

export function ReactionBar({ onReact }: { onReact: (emoji: string) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.reactionBar, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      {REACTIONS.map((emoji) => (
        <Pressable
          key={emoji}
          onPress={() => {
            void Haptics.selectionAsync();
            onReact(emoji);
          }}
          hitSlop={4}
          accessibilityLabel={`React ${emoji}`}
          style={({ pressed }) => [styles.reactionBtn, pressed && { transform: [{ scale: 1.25 }] }]}>
          <Text style={styles.reactionEmoji}>{emoji}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function FloatingReaction({ emoji, x }: { emoji: string; x: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) });
  }, [t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value < 0.75 ? 1 : (1 - t.value) * 4,
    transform: [
      { translateY: -t.value * 260 },
      { translateX: Math.sin(t.value * 7) * 14 },
      { scale: 0.7 + Math.min(t.value * 3, 1) * 0.6 },
    ],
  }));
  return (
    <Animated.Text style={[styles.floating, { left: `${Math.round(x * 100)}%` }, style]}>{emoji}</Animated.Text>
  );
}

export function FloatingReactions() {
  const reactions = useGameRoomStore((s) => s.reactions);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {reactions.map((r) => (
        <FloatingReaction key={r.id} emoji={r.emoji} x={r.x} />
      ))}
    </View>
  );
}

/** Voice status + mute toggle shown in the room header. */
export function AudioPill({ onToggleMute }: { onToggleMute: () => void }) {
  const { colors } = useTheme();
  const audio = useGameRoomStore((s) => s.audio);
  const muted = useGameRoomStore((s) => s.muted);
  const partnerInRoom = useGameRoomStore((s) => s.partnerInRoom);
  const pulse = useSharedValue(1);

  useEffect(() => {
    if (audio === 'live') {
      pulse.value = withRepeat(withSequence(withTiming(1.5, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
    } else {
      pulse.value = 1;
    }
  }, [audio, pulse]);

  const dotStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: 2 - pulse.value }));

  if (audio === 'unavailable') {
    return (
      <View style={[styles.audioPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
        <Icon name="micOff" size={15} color={colors.textTertiary} />
        <Text style={[styles.audioText, { color: colors.textTertiary }]}>Voice needs a dev build</Text>
      </View>
    );
  }

  const label =
    audio === 'live' ? (muted ? 'Muted' : 'Voice live') : audio === 'connecting' ? (partnerInRoom ? 'Connecting…' : 'Waiting…') : 'Voice off';
  const color = audio === 'live' && !muted ? colors.success : colors.textSecondary;

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onToggleMute();
      }}
      accessibilityRole="button"
      accessibilityLabel={muted ? 'Unmute microphone' : 'Mute microphone'}
      style={[styles.audioPill, { backgroundColor: colors.surfaceElevated, borderColor: colors.border }]}>
      <View style={styles.audioDotWrap}>
        <Animated.View style={[styles.audioDotHalo, { backgroundColor: color }, dotStyle]} />
        <View style={[styles.audioDot, { backgroundColor: color }]} />
      </View>
      <Icon name={muted ? 'micOff' : 'mic'} size={15} color={color} />
      <Text style={[styles.audioText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** Fades + slides children in — used as the standard entrance for every round. */
export function RoundEnter({ children, delay = 0 }: { children: ReactNode; delay?: number }) {
  return <Animated.View entering={FadeInDown.delay(delay).springify().damping(16)}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  chunky: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    paddingHorizontal: 20,
  },
  chunkyText: { fontWeight: '900', letterSpacing: 0.2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  chipRight: { flexDirection: 'row-reverse' },
  chipRing: { borderWidth: 3, borderRadius: 26, padding: 1 },
  chipName: { fontSize: 12, fontWeight: '700' },
  chipScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  chipScore: { fontSize: 22, fontWeight: '900' },
  chipPop: { fontSize: 14, fontWeight: '900' },
  scoreWrap: { gap: 10 },
  scoreRow: { flexDirection: 'row', alignItems: 'center' },
  roundBox: { alignItems: 'center', minWidth: 64 },
  roundNum: { fontSize: 20, fontWeight: '900' },
  roundLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2 },
  streak: { fontSize: 12, fontWeight: '900' },
  dots: { flexDirection: 'row', gap: 4 },
  dot: { height: 6, borderRadius: 3 },
  reactionBar: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  reactionBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  reactionEmoji: { fontSize: 24 },
  floating: { position: 'absolute', bottom: 70, fontSize: 38 },
  audioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  audioText: { fontSize: 12, fontWeight: '800' },
  audioDotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  audioDot: { width: 8, height: 8, borderRadius: 4 },
  audioDotHalo: { position: 'absolute', width: 8, height: 8, borderRadius: 4 },
});
