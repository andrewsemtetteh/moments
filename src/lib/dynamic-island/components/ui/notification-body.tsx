import { memo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Avatar } from "@/components/ui/primitives";
import { useTheme } from "@/hooks/useTheme";

import { useDynamicNotifications } from "../../hooks/use-dynamic-notifications";
import type { INotificationBody } from "../../interfaces/notification-content.interface";

/** Default card: avatar, title (in the accent colour), one line of message, and an icon on the right. */
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
        <Text numberOfLines={1} style={[styles.title, { color: accent }]}>
          {notification.title}
        </Text>
        {notification.message ? (
          <Text numberOfLines={1} style={[styles.message, { color: colors.textSecondary }]}>
            {notification.message}
          </Text>
        ) : null}
      </View>

      {notification.icon && (notification.avatar || notification.avatarName) ? (
        <Icon name={notification.icon} size={20} color={accent} />
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
    paddingLeft: 11,
    paddingRight: 18,
    gap: 10,
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
    fontWeight: "700",
    letterSpacing: -0.25,
  },
  message: {
    marginTop: 1,
    fontSize: 13,
    fontWeight: "500",
    letterSpacing: -0.2,
  },
});

export { NotificationBody };
