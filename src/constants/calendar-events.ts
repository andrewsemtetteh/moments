import type { ThemeColors } from '@/constants/design-system';
import type { EventType } from '@/types/database';

export interface EventTypeMeta {
  emoji: string;
  label: string;
  description: string;
}

export const EVENT_TYPE_META: Record<EventType, EventTypeMeta> = {
  date: { emoji: '💕', label: 'Date', description: 'A night out together' },
  anniversary: { emoji: '🎉', label: 'Anniversary', description: 'Celebrate a milestone' },
  reminder: { emoji: '⏰', label: 'Reminder', description: 'Something to remember' },
  experience: { emoji: '✨', label: 'Experience', description: 'An activity or adventure' },
  custom: { emoji: '📌', label: 'Custom', description: 'Anything else you plan' },
};

export const EVENT_TYPES: EventType[] = ['date', 'anniversary', 'reminder', 'experience', 'custom'];

function hexToRgba(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) return hex;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getEventTypeColors(type: EventType, colors: ThemeColors) {
  switch (type) {
    case 'date':
      return { main: colors.accent, soft: colors.accentSoft, onMain: colors.onAccent };
    case 'anniversary':
      return { main: colors.warning, soft: hexToRgba(colors.warning, 0.16), onMain: '#1A1408' };
    case 'reminder':
      return { main: colors.success, soft: hexToRgba(colors.success, 0.16), onMain: '#FFFFFF' };
    case 'experience':
      return { main: colors.chatReadReceipt, soft: hexToRgba(colors.chatReadReceipt, 0.16), onMain: '#FFFFFF' };
    case 'custom':
    default:
      return { main: colors.textSecondary, soft: colors.surfaceElevated, onMain: colors.text };
  }
}
