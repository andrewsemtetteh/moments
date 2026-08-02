import { formatDistanceToNow } from 'date-fns';

export type PartnerStatusVariant = 'typing' | 'online' | 'lastSeen' | 'away';

export interface PartnerStatus {
  label: string;
  variant: PartnerStatusVariant;
}

/**
 * - Away: you or your partner turned off online status (reciprocal)
 * - Online / last seen: both share status and presence / last_seen_at is known
 * - Typing always wins (in-chat activity, not presence history)
 */
export function formatPartnerStatus(
  isTyping: boolean,
  isOnline: boolean,
  lastSeenAt: string | null,
  statusHidden = false,
): PartnerStatus {
  if (isTyping) return { label: 'typing…', variant: 'typing' };
  if (statusHidden) return { label: 'away', variant: 'away' };
  if (isOnline) return { label: 'online', variant: 'online' };
  if (lastSeenAt) {
    return {
      label: `active ${formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true })}`,
      variant: 'lastSeen',
    };
  }
  return { label: 'offline', variant: 'lastSeen' };
}

export function partnerStatusColor(
  variant: PartnerStatusVariant,
  colors: { accent: string; success: string; textSecondary: string },
): string {
  if (variant === 'typing') return colors.accent;
  if (variant === 'online') return colors.success;
  return colors.textSecondary;
}
