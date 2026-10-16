import * as Haptics from '@/lib/haptics';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef, type ReactNode } from 'react';
import { Platform, useWindowDimensions } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import { DynamicNotifications, useDynamicNotifications } from '@/lib/dynamic-island';
import { subscribeIsland } from '@/lib/in-app-notify';
import { openFromNotification } from '@/lib/notification-navigation';

/** How long one island stays open before it tucks back up: every pop, always 5 seconds. */
const ISLAND_MS = 5000;
/** A compact pill, close under the island, like the system's own. */
const CARD_HEIGHT = 60;
const CARD_MAX_WIDTH = 360;
const CARD_SIDE_MARGIN = 20;
const CARD_GAP = 12;

/** Turns app events into island pops, skipping ones for the screen you're already on. */
function IslandListener() {
  const { trigger, dismiss } = useDynamicNotifications();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);

  useEffect(
    () =>
      subscribeIsland((event) => {
        if (event.id) {
          if (seen.current.has(event.id)) return;
          seen.current.add(event.id);
        }
        if (event.hideOn?.(pathRef.current)) return;

        const { target } = event;
        if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        trigger({
          id: event.id,
          title: event.title,
          message: event.message,
          icon: event.icon,
          avatar: event.avatar,
          avatarName: event.avatarName,
          duration: ISLAND_MS,
          onPress: target
            ? () => {
                dismiss();
                void openFromNotification(target, router);
              }
            : undefined,
        });
      }),
    [trigger, dismiss],
  );

  return null;
}

/** Dynamic Island style in-app notifications, drawn over every screen and sheet. */
export function DynamicIslandHost({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  return (
    <DynamicNotifications
      cardWidth={Math.min(width - CARD_SIDE_MARGIN * 2, CARD_MAX_WIDTH)}
      cardHeight={CARD_HEIGHT}
      cardRadius={CARD_HEIGHT / 2}
      gap={CARD_GAP}
      duration={ISLAND_MS}
      cardColor={colors.surfaceElevated}
      accent={colors.accent}
      shadowColor={colors.isDark ? 'rgba(0,0,0,0.55)' : 'rgba(16,19,28,0.20)'}>
      {children}
      <IslandListener />
    </DynamicNotifications>
  );
}
