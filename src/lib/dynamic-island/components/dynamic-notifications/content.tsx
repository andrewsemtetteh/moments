import { AnimatedBlurView } from "../ui/animated-blur-view";
import { NotificationBody } from "../ui/notification-body";
import { useContentBlur } from "../../hooks/use-content-blur";
import { useDismissGesture } from "../../hooks/use-dismiss-gesture";
import { useDynamicNotifications } from "../../hooks/use-dynamic-notifications";
import { useNotificationContentStyle } from "../../hooks/use-notification-content-style";
import type { INotificationContent } from "../../interfaces/notification-content.interface";
import React, { memo } from "react";
import { StyleSheet } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";

const Content: React.FC<INotificationContent> &
  React.FunctionComponent<INotificationContent> = memo<INotificationContent>(
  ({
    style,
  }: INotificationContent):
    | (React.ReactNode & React.ReactElement & React.JSX.Element)
    | null => {
    const {
      layout,
      notification,
      isVisible,
      drop,
      expand,
      reveal,
      dragY,
      dismiss,
      cardColor,
    } = useDynamicNotifications();

    const animated = useNotificationContentStyle({
      drop,
      expand,
      reveal,
      offset: dragY,
      layout,
    });
    const blur = useContentBlur({ reveal });
    const gesture = useDismissGesture({
      offset: dragY,
      onDismiss: dismiss,
      onPress: notification?.onPress,
    });

    if (!notification) {
      return null;
    }

    return (
      <GestureDetector gesture={gesture}>
        <Animated.View
          pointerEvents={isVisible ? "auto" : "none"}
          style={[
            styles.content,
            {
              top: layout.cardTop,
              left: layout.cardLeft,
              width: layout.cardWidth,
              height: layout.cardHeight,
              borderRadius: layout.cardRadius,
            },
            animated,
            style,
          ]}
        >
          {notification.render ? (
            notification.render(notification)
          ) : (
            <NotificationBody notification={notification} />
          )}

          <AnimatedBlurView
            pointerEvents="none"
            tint={isDark(cardColor) ? "dark" : "light"}
            blurMethod="dimezisBlurViewSdk31Plus"
            animatedProps={blur.animatedProps}
            style={[
              StyleSheet.absoluteFill,
              { borderRadius: layout.cardRadius },
              styles.blur,
              blur.animatedStyle,
            ]}
          />
        </Animated.View>
      </GestureDetector>
    );
  },
);

/** The reveal blur matches the card, so a dark card doesn't flash white as it opens. */
function isDark(color: string): boolean {
  const m = /^#?([0-9a-f]{6})/i.exec(color);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255 < 0.5;
}

const styles = StyleSheet.create({
  content: {
    position: "absolute",
    overflow: "hidden",
    borderCurve: "continuous",
  },
  blur: {
    borderCurve: "continuous",
  },
});

export { Content };
