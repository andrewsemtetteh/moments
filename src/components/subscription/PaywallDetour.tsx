import { useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { PrivacyDocument, TermsDocument } from '@/components/legal/LegalDocs';
import { ReferPage } from '@/components/referral/ReferPage';
import { useTheme } from '@/hooks/useTheme';

export type PaywallDetourPage = 'terms' | 'privacy' | 'refer';

const SCREEN_W = Dimensions.get('window').width;
const OPEN_SPRING = { damping: 30, stiffness: 280, mass: 0.9 };

/**
 * Terms, Privacy and "invite a couple", opened from the paywall: they slide in
 * over it instead of closing it and navigating away, so Back (or a swipe right)
 * slides them off and the paywall is right there, exactly as it was.
 */
export function PaywallDetour({ page, onClose }: { page: PaywallDetourPage; onClose: () => void }) {
  const { colors } = useTheme();
  const x = useSharedValue(SCREEN_W);

  useEffect(() => {
    x.set(withSpring(0, OPEN_SPRING));
  }, [x]);

  const close = () => {
    x.set(
      withTiming(SCREEN_W, { duration: 220 }, (done) => {
        if (done) runOnJS(onClose)();
      }),
    );
  };

  // Swipe right anywhere to go back, following the finger like the app's other pages.
  const swipeBack = Gesture.Pan()
    .activeOffsetX(14)
    .failOffsetX(-10)
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      x.set(Math.max(0, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX > SCREEN_W * 0.3 || e.velocityX > 700) {
        x.set(
          withTiming(SCREEN_W, { duration: 180 }, (done) => {
            if (done) runOnJS(onClose)();
          }),
        );
        return;
      }
      x.set(withSpring(0, OPEN_SPRING));
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <GestureDetector gesture={swipeBack}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }, style]}>
        {page === 'terms' ? (
          <TermsDocument onBack={close} />
        ) : page === 'privacy' ? (
          <PrivacyDocument onBack={close} />
        ) : (
          <ReferPage onBack={close} />
        )}
      </Animated.View>
    </GestureDetector>
  );
}
