import { router, usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/ui/Icon';
import { useUIStore } from '@/stores';

const TAB_PATHS = new Set(['/home', '/activities', '/profile', '/']);

/** Everything a preview turns on, off again. */
const CLEARED = { devPreview: false, authPreview: false } as const;

/** Leaves any developer preview: back to Settings, wherever the preview had got to. */
export function exitDevPreview(pathname?: string) {
  useUIStore.setState(CLEARED);
  // A preview that ended on a tab (the onboarding walkthrough lands on Home): Settings opens over it.
  if (pathname && TAB_PATHS.has(pathname)) {
    router.push('/settings');
    return;
  }
  try {
    router.dismissTo('/settings');
  } catch {
    router.navigate('/settings');
  }
}

/**
 * Settings › Developer previews that walk through real screens (onboarding, sign-in,
 * widgets) get this pill on top of every screen, so one tap gets you out from anywhere.
 */
export function DevPreviewExit() {
  const insets = useSafeAreaInsets();
  const previewing = useUIStore((s) => s.devPreview || s.authPreview);
  const pathname = usePathname();
  const onSettings = pathname === '/settings';

  // Back on Settings by any route (Back, finishing the flow): the preview is over.
  useEffect(() => {
    if (previewing && onSettings) useUIStore.setState(CLEARED);
  }, [previewing, onSettings]);

  if (!__DEV__ || !previewing || onSettings) return null;
  return (
    <Pressable
      onPress={() => exitDevPreview(pathname)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel="Exit preview"
      style={({ pressed }) => [styles.pill, { top: insets.top + 6 }, pressed && styles.pressed]}>
      <Icon name="close" size={14} color="#fff" />
      <Text style={styles.text}>Exit preview</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Top right, clear of the back arrows on the left; dark so it reads on every theme.
  pill: {
    position: 'absolute',
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(17,17,17,0.82)',
    zIndex: 100,
    elevation: 100,
  },
  pressed: { opacity: 0.7 },
  text: { color: '#fff', fontSize: 13, fontWeight: '800' },
});
