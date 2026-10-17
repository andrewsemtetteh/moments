import * as Haptics from '@/lib/haptics';
import { useState } from 'react';
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

const ROW_W = 280;
const LOCKET_BTN = 42;

const LOCKET_SLOTS = [
  { key: 'laugh', emoji: '😂' },
  { key: 'heart', emoji: '❤️' },
  { key: 'sad', emoji: '🥹' },
  { key: 'fire', emoji: '🔥' },
  { key: 'plus', type: 'plus' as const },
] as const;

interface LocketReactionClusterProps {
  moment: Moment;
  width?: number;
  onReact: (emoji: string) => void;
  /** preview: parent controls visibility; home: always shows the row when rendered */
  variant?: 'home' | 'preview';
  onPicked?: () => void;
  /** Dark styling, for the moment viewer. */
  dark?: boolean;
}

export function LocketReactionCluster({
  moment,
  width,
  onReact,
  variant = 'home',
  onPicked,
  dark = false,
}: LocketReactionClusterProps) {
  const theme = useTheme().colors;
  // In the dark moment viewer, the picker goes dark too.
  const colors = dark
    ? {
        ...theme,
        surface: 'rgba(255,255,255,0.10)',
        surfaceElevated: 'rgba(255,255,255,0.14)',
        border: 'rgba(255,255,255,0.16)',
        text: '#FFFFFF',
      }
    : theme;
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';
  const userReaction = getUserReactionEmoji(moment, userId);
  const [showExtra, setShowExtra] = useState(false);
  const [pickedThisSession, setPickedThisSession] = useState(false);

  // Another moment: reactions start closed and unpicked (while rendering).
  const [forMoment, setForMoment] = useState(moment.id);
  if (forMoment !== moment.id) {
    setForMoment(moment.id);
    setShowExtra(false);
    setPickedThisSession(false);
  }

  const rowW = width ?? ROW_W;
  const scale = Math.min(1, rowW / ROW_W);
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
        <View
          style={[
            styles.extraDrawer,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}>
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

      <View style={[styles.row, { width: rowW }]}>
        {LOCKET_SLOTS.map((slot) => {
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
                  width: btnSize,
                  height: btnSize,
                  borderRadius: btnSize / 2,
                  backgroundColor: colors.surfaceElevated,
                  borderColor: active || (isPlus && showExtra) ? colors.accent : colors.border,
                  borderWidth: active || (isPlus && showExtra) ? 2 : StyleSheet.hairlineWidth,
                },
              ]}>
              {isPlus ? (
                <Icon name={showExtra ? 'close' : 'plus'} size={glyphSize} color={colors.text} />
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  btn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: { textAlign: 'center' },
  extraDrawer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 10,
    padding: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  extraBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
