import * as Haptics from '@/lib/haptics';
import { useCallback, useEffect, useState } from 'react';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';

import { Icon } from '@/components/ui/Icon';
import { useTheme } from '@/hooks/useTheme';
import { FAB_ACTIONS, type PlanKindKey } from '@/lib/plan-meta';

const RADIUS = 118;
const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export function PlanRadialFab({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (kind: PlanKindKey) => void;
}) {
  const { colors } = useTheme();
  // `open` flips to false the instant a press handler calls onClose, but the Modal that
  // hosts this content can't animate its own dismissal — unmounting it immediately would
  // cut the fade/scale-out short. Stay mounted through the close animation ourselves,
  // the same pattern DraggableSheet uses.
  const [mounted, setMounted] = useState(open);
  const backdropOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0.85);

  useEffect(() => {
    if (open) {
      setMounted(true);
      backdropOpacity.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) });
      ringScale.value = withTiming(1, { duration: 160, easing: Easing.out(Easing.cubic) });
    } else if (mounted) {
      backdropOpacity.value = withTiming(0, { duration: 120 });
      ringScale.value = withTiming(0.85, { duration: 120, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const select = useCallback(
    (kind: PlanKindKey) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(kind);
      onClose();
    },
    [onSelect, onClose],
  );

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
        <View style={styles.stage} pointerEvents="box-none">
          <Animated.View style={[styles.ring, ringStyle]} pointerEvents="box-none">
            {FAB_ACTIONS.map((action, index) => {
              const angle = (-90 + index * 60) * (Math.PI / 180);
              const x = Math.cos(angle) * RADIUS;
              const y = Math.sin(angle) * RADIUS;
              return (
                <Animated.View
                  key={action.key}
                  entering={open ? ZoomIn.delay(40 + index * 30).springify().damping(14) : undefined}
                  style={[
                    styles.actionWrap,
                    { transform: [{ translateX: x }, { translateY: y }] },
                  ]}>
                  <Pressable
                    onPress={() => select(action.key)}
                    style={[
                      styles.action,
                      {
                        backgroundColor: colors.backgroundElevated,
                        borderColor: colors.border,
                        shadowColor: colors.shadow,
                      },
                    ]}>
                    <Icon name={action.icon} size={24} color={colors.text} />
                    <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </Animated.View>

          <Animated.View entering={open ? ZoomIn.springify().damping(14) : undefined}>
            <Pressable
              onPress={onClose}
              style={[styles.center, { backgroundColor: colors.accent, shadowColor: colors.shadow }]}>
              <Icon name="close" size={26} color={colors.onAccent} />
            </Pressable>
          </Animated.View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  stage: {
    position: 'absolute',
    left: SCREEN_W / 2,
    top: SCREEN_H * 0.42,
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionWrap: {
    position: 'absolute',
    width: 76,
    height: 76,
    marginLeft: -38,
    marginTop: -38,
  },
  action: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    elevation: 4,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  actionEmoji: { fontSize: 22 },
  actionLabel: { fontSize: 10, fontWeight: '700' },
  center: {
    width: 64,
    height: 64,
    marginLeft: -32,
    marginTop: -32,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
});
