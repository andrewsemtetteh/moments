import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native-gesture-handler';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import {
  getUserReactionEmoji,
  LOCKET_EXTRA_EMOJIS,
} from '@/lib/moment-display';
import { useAuthStore } from '@/stores';
import type { Moment } from '@/types/database';

const ARC_W = 280;
const LOCKET_BTN = 42;
const LOCKET_STAGE_H = 104;

const LOCKET_SLOTS = [
  { key: 'laugh', emoji: '😂', x: 0.17, y: 30 },
  { key: 'heart', emoji: '❤️', x: 0.5, y: 4 },
  { key: 'plus', type: 'plus' as const, x: 0.83, y: 30 },
  { key: 'sad', emoji: '🥹', x: 0.32, y: 58 },
  { key: 'fire', emoji: '🔥', x: 0.68, y: 58 },
] as const;

interface LocketReactionClusterProps {
  moment: Moment;
  width?: number;
  onReact: (emoji: string) => void;
  /** preview: parent controls visibility; home: always shows arc when rendered */
  variant?: 'home' | 'preview';
  onPicked?: () => void;
}

export function LocketReactionCluster({
  moment,
  width,
  onReact,
  variant = 'home',
  onPicked,
}: LocketReactionClusterProps) {
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';
  const userReaction = getUserReactionEmoji(moment, userId);
  const [showExtra, setShowExtra] = useState(false);
  const [pickedThisSession, setPickedThisSession] = useState(false);

  useEffect(() => {
    setShowExtra(false);
    setPickedThisSession(false);
  }, [moment.id]);

  const stageW = width ?? ARC_W;
  const scale = stageW / ARC_W;
  const stageH = Math.round(LOCKET_STAGE_H * scale);
  const btnSize = Math.round(LOCKET_BTN * scale);
  const glyphSize = Math.round(20 * scale);

  const pick = (emoji: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onReact(emoji);
    setPickedThisSession(true);
    setShowExtra(false);
    onPicked?.();
  };

  const showActive = (emoji: string) =>
    variant === 'preview'
      ? userReaction === emoji
      : pickedThisSession && userReaction === emoji;

  return (
    <View style={styles.wrap}>
      {showExtra && (
        <View style={[styles.extraRow, { marginBottom: 8 }]}>
          {LOCKET_EXTRA_EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => pick(emoji)}
              style={[
                styles.extraBtn,
                {
                  width: btnSize,
                  height: btnSize,
                  borderRadius: btnSize / 2,
                  backgroundColor: colors.surfaceElevated,
                  borderColor: showActive(emoji) ? colors.accent : colors.border,
                  borderWidth: showActive(emoji) ? 2 : StyleSheet.hairlineWidth,
                },
              ]}>
              <Text style={{ fontSize: glyphSize }}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={[styles.stage, { width: stageW, height: stageH }]}>
        {LOCKET_SLOTS.map((slot) => {
          const left = slot.x * stageW - btnSize / 2;
          const top = Math.round(slot.y * scale);
          const isPlus = 'type' in slot && slot.type === 'plus';
          const emoji = 'emoji' in slot ? slot.emoji : null;
          const active = emoji !== null && showActive(emoji);

          return (
            <Pressable
              key={slot.key}
              onPress={() => (isPlus ? setShowExtra((v) => !v) : pick(emoji!))}
              style={[
                styles.btn,
                {
                  left,
                  top,
                  width: btnSize,
                  height: btnSize,
                  borderRadius: btnSize / 2,
                  backgroundColor: colors.surfaceElevated,
                  borderColor: active || (isPlus && showExtra) ? colors.accent : colors.border,
                  borderWidth: active || (isPlus && showExtra) ? 2 : StyleSheet.hairlineWidth,
                },
              ]}>
              {isPlus ? (
                <Icon name="plus" size={glyphSize} color={colors.text} />
              ) : (
                <Text style={[styles.glyph, { fontSize: glyphSize }]}>{emoji}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', width: '100%' },
  stage: { position: 'relative' },
  btn: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { textAlign: 'center' },
  extraRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 8,
  },
  extraBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
