/** Extra plan fields stored in calendar_events.description as JSON. */

export type PlanChecklistItem = {
  id: string;
  title: string;
  done: boolean;
};

export type PlanKindKey =
  | 'date'
  | 'trip'
  | 'celebration'
  | 'activity'
  | 'outing'
  | 'custom'
  | 'reminder'
  | 'note'
  | 'checklist'
  | 'goal';

export type PlanMeta = {
  v: 1;
  kind?: PlanKindKey;
  location?: string;
  notes?: string;
  reminderMins?: number | null;
  checklist?: PlanChecklistItem[];
  completed?: boolean;
  /** Shared list created for / linked to this plan */
  linkedListId?: string;
};

export const PLAN_KIND_OPTIONS: {
  key: PlanKindKey;
  label: string;
  emoji: string;
  eventType: 'date' | 'anniversary' | 'reminder' | 'experience' | 'custom';
}[] = [
  { key: 'date', label: 'Date', emoji: '❤️', eventType: 'date' },
  { key: 'trip', label: 'Trip', emoji: '✈️', eventType: 'experience' },
  { key: 'celebration', label: 'Celebration', emoji: '🎉', eventType: 'anniversary' },
  { key: 'activity', label: 'Activity', emoji: '🎬', eventType: 'experience' },
  { key: 'outing', label: 'Outing', emoji: '☕', eventType: 'custom' },
  { key: 'custom', label: 'Custom', emoji: '📝', eventType: 'custom' },
];

export const FAB_ACTIONS: {
  key: PlanKindKey;
  label: string;
  emoji: string;
  eventType: 'date' | 'anniversary' | 'reminder' | 'experience' | 'custom';
}[] = [
  { key: 'date', label: 'Date', emoji: '❤️', eventType: 'date' },
  { key: 'trip', label: 'Trip', emoji: '✈️', eventType: 'experience' },
  { key: 'reminder', label: 'Reminder', emoji: '🔔', eventType: 'reminder' },
  { key: 'goal', label: 'Goal', emoji: '🎯', eventType: 'custom' },
  { key: 'checklist', label: 'Checklist', emoji: '✅', eventType: 'reminder' },
  { key: 'note', label: 'Note', emoji: '📝', eventType: 'custom' },
];

export const REMINDER_OPTIONS: { label: string; mins: number | null }[] = [
  { label: 'None', mins: null },
  { label: 'At time of event', mins: 0 },
  { label: '15 minutes before', mins: 15 },
  { label: '1 hour before', mins: 60 },
  { label: '1 day before', mins: 60 * 24 },
];

export function parsePlanMeta(description: string | null | undefined): PlanMeta {
  if (!description) return { v: 1 };
  try {
    const parsed = JSON.parse(description) as PlanMeta;
    if (parsed && parsed.v === 1) return parsed;
  } catch {
    // Legacy plain-text description → notes
    return { v: 1, notes: description };
  }
  return { v: 1, notes: description };
}

export function serializePlanMeta(meta: PlanMeta): string {
  const { v: _v, ...rest } = meta;
  return JSON.stringify({ v: 1, ...rest });
}

export function planCountdownParts(at: Date, now = new Date()) {
  const ms = Math.max(0, at.getTime() - now.getTime());
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return { days, hours, mins, totalMs: ms };
}

export function isPlanCompleted(event: { date_time: string; description?: string | null }, now = new Date()) {
  const meta = parsePlanMeta(event.description);
  if (meta.completed === true) return true;
  if (meta.completed === false) return false;
  return new Date(event.date_time).getTime() <= now.getTime();
}

export function planKindEmoji(event: { type: string; description?: string | null }): string | null {
  const meta = parsePlanMeta(event.description);
  if (!meta.kind) return null;
  const fromKinds = PLAN_KIND_OPTIONS.find((k) => k.key === meta.kind);
  if (fromKinds) return fromKinds.emoji;
  const fromFab = FAB_ACTIONS.find((k) => k.key === meta.kind);
  return fromFab?.emoji ?? null;
}

export function reminderLabel(mins: number | null | undefined): string {
  if (mins === undefined) return 'None';
  const match = REMINDER_OPTIONS.find((o) => o.mins === mins);
  return match?.label ?? 'None';
}
