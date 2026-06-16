import { formatDistanceToNow } from 'date-fns';

export type PartnerStatusVariant = 'typing' | 'online' | 'lastSeen' | 'away';

export interface PartnerStatus {
  label: string;
  variant: PartnerStatusVariant;
}

export function formatPartnerStatus(
  isTyping: boolean,
  isOnline: boolean,
  lastSeenAt: string | null,
): PartnerStatus {
  if (isTyping) return { label: 'typing…', variant: 'typing' };
  if (isOnline) return { label: 'online', variant: 'online' };
  if (lastSeenAt) {
    return {
      label: `last seen ${formatDistanceToNow(new Date(lastSeenAt), { addSuffix: true })}`,
      variant: 'lastSeen',
    };
  }
  return { label: 'away', variant: 'away' };
}

export function partnerStatusColor(
  variant: PartnerStatusVariant,
  colors: { accent: string; success: string; textSecondary: string },
): string {
  if (variant === 'typing') return colors.accent;
  if (variant === 'online') return colors.success;
  return colors.textSecondary;
}
