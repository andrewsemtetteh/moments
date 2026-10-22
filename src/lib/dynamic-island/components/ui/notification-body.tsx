import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/primitives";
import { useTheme } from "@/hooks/useTheme";

import { useDynamicNotifications } from "../../hooks/use-dynamic-notifications";
import type { INotificationBody } from "../../interfaces/notification-content.interface";

/**
 * Default card: avatar (or icon), who or what in bold, then the whole message (up to
 * three lines; the card grows to fit), and the kind of notification on the right.
 */
/** A message shows in full up to this many lines (the host sizes the card to match). */
export const ISLAND_MAX_LINES = 3;
export const ISLAND_LINE_HEIGHT = 18;

const NotificationBody = memo<INotificationBody>(({ notification }: INotificationBody) => {
  const context = useDynamicNotifications();
  const { colors } = useTheme();
  const accent = notification.accent ?? context.accent;

  return (
    <View style={styles.body}>
      {notification.avatar || notification.avatarName ? (
        <Avatar name={notification.avatarName} imageUrl={notification.avatar} size={38} />
      ) : (
        <View style={[styles.iconBubble, { backgroundColor: colors.accentSoft }]}>
          <Icon name={notification.icon ?? "bell"} size={19} color={accent} />
        </View>
      )}

      <View style={styles.copy}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
          {notification.title}
        </Text>
        {notification.message ? (
          <Text numberOfLines={ISLAND_MAX_LINES} style={[styles.message, { color: colors.textSecondary }]}>
            {notification.message}
          </Text>
        ) : null}
      </View>

      {notification.icon && (notification.avatar || notification.avatarName) ? (
        <View style={[styles.kind, { backgroundColor: colors.accentSoft }]}>
          <Icon name={notification.icon} size={16} color={accent} />
        </View>
      ) : null}
    </View>
  );
});
NotificationBody.displayName = "NotificationBody";

const styles = StyleSheet.create({
  body: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 12,
    paddingRight: 14,
    paddingVertical: 10,
    gap: 11,
  },
  kind: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBubble: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  copy: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    letterSpacing: -0.25,
  },
  message: {
    marginTop: 1,
    fontSize: 13.5,
    lineHeight: ISLAND_LINE_HEIGHT,
    fontWeight: "500",
    letterSpacing: -0.15,
  },
});

export { NotificationBody };
