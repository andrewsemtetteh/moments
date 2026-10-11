import { StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/ui/Logo';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function AnimatedSplashOverlay() {
  return null;
}

/** Renders statically — react-native-reanimated's web layout/style animations have
 * proven unreliable here (both `entering` cleanup crashes and silent invisible paints),
 * so this trades the bounce-in for something that reliably shows up. */
export function AnimatedIcon() {
  const theme = useTheme();

  return (
    <View style={styles.iconContainer}>
      <View style={[styles.background, { backgroundColor: theme.backgroundElement }]} />
      <View style={styles.imageContainer}>
        <LogoMark size={96} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
    overflow: 'hidden',
    borderRadius: Radius.xl,
    width: 128,
    height: 128,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 128,
    height: 128,
  },
  background: {
    borderRadius: Radius.xl,
    width: 128,
    height: 128,
    position: 'absolute',
    zIndex: 1,
  },
});
