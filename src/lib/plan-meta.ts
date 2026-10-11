import type { IconName } from '@/components/ui/Icon';

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

  // ── Whose plan (Upcoming lanes) ─────────────────────────────────────────
  /** User id of the partner it belongs to; missing = a plan for both of you. */
  owner?: string;
  /** Partner sees only "Busy" for it. Only meaningful on a personal plan. */
  private?: boolean;

  // ── Entries that aren't plans (stored in the same synced table) ─────────
  /** Missing = a plan. `memory` = an entry on Memories; `dayNote` = "my day" line. */
  entry?: 'plan' | 'memory' | 'dayNote';
  /** Memory kind (Milestone, Date, Trip…). */
  memoryType?: MemoryType;
  /** Moments attached to a memory (resolved from loaded moments when possible). */
  momentIds?: string[];
  /** Gallery photos uploaded for a memory. */
  photoUrls?: string[];
  /** Each attached moment's media URL at save time — used when that moment isn't loaded. */
  momentPhotoUrls?: Record<string, string>;
  /** Place name shown on a memory ("☕ The café"). */
  placeName?: string;
  /** Per-user emoji reaction (memories) or cheer (day notes): userId → emoji/text. */
  reactions?: Record<string, string>;
  /** "How was it?" rating per user (emoji). */
  ratings?: Record<string, string>;
  /** Memory made from a finished plan. */
  fromPlanId?: string;
  /** On a plan: users who already answered (or skipped) "How was it?". */
  reviewedBy?: string[];
  createdBy?: string;
};

export type MemoryType = 'milestone' | 'date' | 'trip' | 'celebration' | 'justus';

export const MEMORY_TYPES: { key: MemoryType; label: string; emoji: string; icon: IconName }[] = [
  { key: 'milestone', label: 'Milestone', emoji: '💞', icon: 'flag' },
  { key: 'date', label: 'Date', emoji: '🍝', icon: 'heart' },
  { key: 'trip', label: 'Trip', emoji: '✈️', icon: 'airplane' },
  { key: 'celebration', label: 'Celebration', emoji: '🎉', icon: 'balloon' },
  { key: 'justus', label: 'Just us', emoji: '✨', icon: 'people' },
];

export function memoryTypeMeta(type: MemoryType | undefined) {
  return MEMORY_TYPES.find((t) => t.key === type) ?? MEMORY_TYPES[4];
}

/** Plans are everything that isn't a memory or a day note — old rows included. */
export function isPlanEvent(event: { description?: string | null }) {
  const entry = parsePlanMeta(event.description).entry;
  return entry === undefined || entry === 'plan';
}

export function isMemoryEvent(event: { description?: string | null }) {
  return parsePlanMeta(event.description).entry === 'memory';
}

export function isDayNoteEvent(event: { description?: string | null }) {
  return parsePlanMeta(event.description).entry === 'dayNote';
}

/**
 * The plan types you can pick, mirroring the memory types (Date, Trip,
 * Celebration…) so a finished plan maps cleanly onto a memory. Activity is
 * for the personal things each of you does (gym, a class, practice).
 */
export const PLAN_KIND_OPTIONS: {
  key: PlanKindKey;
  label: string;
  emoji: string;
  icon: IconName;
  eventType: 'date' | 'anniversary' | 'reminder' | 'experience' | 'custom';
}[] = [
  { key: 'date', label: 'Date', emoji: '❤️', icon: 'heart', eventType: 'date' },
  { key: 'trip', label: 'Trip', emoji: '✈️', icon: 'airplane', eventType: 'experience' },
  { key: 'celebration', label: 'Celebration', emoji: '🎉', icon: 'balloon', eventType: 'anniversary' },
  { key: 'outing', label: 'Outing', emoji: '☕', icon: 'cafe', eventType: 'custom' },
  { key: 'activity', label: 'Activity', emoji: '🏃', icon: 'walk', eventType: 'experience' },
  { key: 'reminder', label: 'Reminder', emoji: '🔔', icon: 'bell', eventType: 'reminder' },
  { key: 'custom', label: 'Other', emoji: '📝', icon: 'edit', eventType: 'custom' },
];

/**
 * Types older plans may still carry (no longer offered). Kept so those plans
 * keep their icon and label.
 */
export const FAB_ACTIONS: {
  key: PlanKindKey;
  label: string;
  emoji: string;
  icon: IconName;
  eventType: 'date' | 'anniversary' | 'reminder' | 'experience' | 'custom';
}[] = [
  { key: 'goal', label: 'Goal', emoji: '🎯', icon: 'target', eventType: 'custom' },
  { key: 'checklist', label: 'Checklist', emoji: '✅', icon: 'checkDone', eventType: 'reminder' },
  { key: 'note', label: 'Note', emoji: '📝', icon: 'document', eventType: 'custom' },
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

/**
 * Each icon has its own color, so a plan or memory reads at a glance:
 * dates pink, trips blue, celebrations orange… Mid-tone hues that hold up on
 * both the black and the paper theme.
 */
const ICON_COLORS: Partial<Record<IconName, string>> = {
  heart: '#E85D75', // date
  airplane: '#5B8DEF', // trip
  balloon: '#F2994A', // celebration / anniversary
  film: '#9B7BEA', // activity
  cafe: '#C08552', // outing
  bell: '#E8B33C', // reminder
  target: '#34A853', // goal
  checkDone: '#2BB3A3', // checklist
  flag: '#B565D8', // milestone
  sparkles: '#E8B33C', // just us / experience
};
const NEUTRAL_KIND_COLOR = '#8E8E93';

export function iconColor(icon: IconName): string {
  return ICON_COLORS[icon] ?? NEUTRAL_KIND_COLOR;
}

/** Soft tinted background behind a kind icon (~14% of its color). */
export function iconTint(icon: IconName): string {
  return `${iconColor(icon)}24`;
}

/** Event types without a plan kind (older plans, activity/experience rows). */
const EVENT_TYPE_ICON: Record<string, IconName> = {
  date: 'heart',
  anniversary: 'balloon',
  reminder: 'bell',
  experience: 'sparkles',
  custom: 'calendar',
};

/** The icon shown for a plan everywhere (lists, details, Coming up). */
export function planIcon(event: { type: string; description?: string | null }): IconName {
  const meta = parsePlanMeta(event.description);
  if (meta.kind) {
    const k = PLAN_KIND_OPTIONS.find((o) => o.key === meta.kind) ?? FAB_ACTIONS.find((o) => o.key === meta.kind);
    if (k) return k.icon;
  }
  return EVENT_TYPE_ICON[event.type] ?? 'calendar';
}

export function reminderLabel(mins: number | null | undefined): string {
  if (mins === undefined) return 'None';
  const match = REMINDER_OPTIONS.find((o) => o.mins === mins);
  return match?.label ?? 'None';
}
