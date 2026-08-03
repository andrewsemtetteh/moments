import * as Haptics from 'expo-haptics';
import { Dimensions, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';

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

  if (!open) return null;

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.stage} pointerEvents="box-none">
          <Animated.View
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(120)}
            style={styles.ring}
            pointerEvents="box-none">
            {FAB_ACTIONS.map((action, index) => {
              const angle = (-90 + index * 60) * (Math.PI / 180);
              const x = Math.cos(angle) * RADIUS;
              const y = Math.sin(angle) * RADIUS;
              return (
                <Animated.View
                  key={action.key}
                  entering={ZoomIn.delay(40 + index * 30).springify().damping(14)}
                  style={[
                    styles.actionWrap,
                    { transform: [{ translateX: x }, { translateY: y }] },
                  ]}>
                  <Pressable
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      onSelect(action.key);
                      onClose();
                    }}
                    style={[
                      styles.action,
                      {
                        backgroundColor: colors.backgroundElevated,
                        borderColor: colors.border,
                        shadowColor: colors.shadow,
                      },
                    ]}>
                    <Text style={styles.actionEmoji}>{action.emoji}</Text>
                    <Text style={[styles.actionLabel, { color: colors.text }]}>{action.label}</Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </Animated.View>

          <Animated.View entering={ZoomIn.springify().damping(14)}>
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
    flex: 1,
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
