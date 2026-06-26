import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Single subtle fade for auth form screens — no per-field stagger. */
export function AuthScreenEnter({ children, style }: Props) {
  return (
    <Animated.View entering={FadeIn.duration(280)} style={style}>
      {children}
    </Animated.View>
  );
}
