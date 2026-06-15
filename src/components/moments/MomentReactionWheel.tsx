import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/ui/Icon';
import { useMomentReaction } from '@/hooks/queries';
import { useAuthStore } from '@/stores';
import type { Moment } from '@/types/database';

const ARC_W = 280;
const BTN = 48;

/** Locket-style cluster: heart apex, laugh/+ on middle row, two emojis tucked below */
const LOCKET_BTN = 42;
const LOCKET_SLOTS = [
  { key: 'laugh', emoji: '😂', x: 0.17, y: 30 },
  { key: 'heart', emoji: '❤️', x: 0.5, y: 4 },
  { key: 'plus', type: 'plus' as const, x: 0.83, y: 30 },
  { key: 'sad', emoji: '🥹', x: 0.32, y: 58 },
  { key: 'fire', emoji: '🔥', x: 0.68, y: 58 },
] as const;

const LOCKET_STAGE_H = 104;

interface MomentReactionWheelProps {
  moment: Moment;
  variant?: 'orbit' | 'arc';
  arcCompact?: boolean;
  arcMatchWidth?: number;
  onReact?: (emoji: string) => void;
}

export function MomentReactionWheel({
  moment,
  variant = 'orbit',
  arcMatchWidth,
  onReact,
}: MomentReactionWheelProps) {
  const user = useAuthStore((s) => s.user);
  const reactMutation = useMomentReaction();
  const iLiked = (moment.reactions?.['❤️'] ?? []).includes(user?.id ?? '');

  const react = (emoji: string) => {
    if (onReact) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onReact(emoji);
      return;
    }
    if (moment.id.startsWith('temp-') || moment.id.startsWith('mock-')) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    reactMutation.mutate({ momentId: moment.id, emoji });
  };

  if (variant === 'arc') {
    const stageW = arcMatchWidth ?? ARC_W;
    const scale = stageW / ARC_W;
    const stageH = Math.round(LOCKET_STAGE_H * scale);

    return (
      <View style={styles.arcWrap}>
        <View style={[styles.arcStage, { width: stageW, height: stageH }]}>
          {LOCKET_SLOTS.map((slot) => {
            const size = Math.round(LOCKET_BTN * scale);
            const left = slot.x * stageW - size / 2;
            const top = Math.round(slot.y * scale);
            const isPlus = 'type' in slot && slot.type === 'plus';
            const emoji = 'emoji' in slot ? slot.emoji : null;
            const active =
              emoji !== null && (moment.reactions?.[emoji] ?? []).includes(user?.id ?? '');
            const glyphSize = Math.round(20 * scale);

            return (
              <Pressable
                key={slot.key}
                onPress={() => (isPlus ? react('❤️') : react(emoji!))}
                style={[
                  styles.locketBtn,
                  {
                    left,
                    top,
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                  },
                  active && styles.locketBtnActive,
                ]}>
                {isPlus ? (
                  <Icon name="plus" size={glyphSize} color="#fff" />
                ) : (
                  <Text style={[styles.locketEmoji, { fontSize: glyphSize }]}>{emoji}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }

  const REACTIONS = [
    { emoji: '❤️', label: 'Love' },
    { emoji: '😂', label: 'Laugh' },
    { emoji: '😢', label: 'Sad' },
    { emoji: '🔥', label: 'Fire' },
  ] as const;

  const ORBIT_R = 58;
  const ORBIT_C = 80;

  return (
    <View style={styles.wrap}>
      <View style={styles.orbit}>
        {REACTIONS.map((r, i) => {
          const angle = (i / REACTIONS.length) * Math.PI * 2 - Math.PI / 2;
          const x = Math.cos(angle) * ORBIT_R;
          const y = Math.sin(angle) * ORBIT_R;
          const active = r.emoji === '❤️' ? iLiked : (moment.reactions?.[r.emoji] ?? []).includes(user?.id ?? '');

          return (
            <Pressable
              key={r.emoji}
              onPress={() => react(r.emoji)}
              style={[
                styles.orbitBtn,
                { left: ORBIT_C + x - BTN / 2, top: ORBIT_C + y - BTN / 2 },
                active && styles.orbitBtnActive,
              ]}>
              <Text style={styles.orbitEmoji}>{r.emoji}</Text>
            </Pressable>
          );
        })}

        <Pressable onPress={() => react('❤️')} style={[styles.centerBtn, iLiked && styles.centerBtnActive]}>
          <Icon name="heart" size={28} color={iLiked ? '#FF3040' : '#1a1a1a'} filled={iLiked} />
        </Pressable>
      </View>
      <Text style={styles.privacy}>Private between you two</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 14 },
  orbit: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  orbitBtn: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  orbitBtnActive: { backgroundColor: '#fff', borderWidth: 2, borderColor: '#FF3040' },
  orbitEmoji: { fontSize: 20 },
  centerBtn: {
    position: 'absolute',
    left: 80 - 32,
    top: 80 - 32,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  centerBtnActive: { borderWidth: 2, borderColor: '#FF3040' },
  privacy: { color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  arcWrap: { alignItems: 'center', width: '100%' },
  arcStage: { position: 'relative' },
  locketBtn: {
    position: 'absolute',
    backgroundColor: 'rgba(48,48,52,0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locketBtnActive: { borderWidth: 2, borderColor: '#FF3040' },
  locketEmoji: { textAlign: 'center' },
});
