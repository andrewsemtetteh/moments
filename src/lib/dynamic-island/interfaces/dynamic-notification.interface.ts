import type { ReactNode } from "react";

import type { IconName } from "@/components/ui/Icon";

interface IDynamicNotification {
  id?: string;
  title: string;
  message?: string;
  /** Image URI on the left. */
  avatar?: string | null;
  /** Name for the initials fallback when there's no avatar image. */
  avatarName?: string | null;
  /** App icon: on the right next to an avatar, or in the left bubble when there's no avatar. */
  icon?: IconName;
  accent?: string;
  duration?: number | null;
  /** This card's height (taller for a longer message); the host's cardHeight otherwise. */
  cardHeight?: number;
  onPress?: () => void;
  render?: (notification: IDynamicNotification) => ReactNode;
}

export type { IDynamicNotification };
