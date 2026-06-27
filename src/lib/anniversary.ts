import { format, formatDistanceToNowStrict } from 'date-fns';

import type { Relationship } from '@/types/database';

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Parse YYYY-MM-DD or ISO timestamp as local calendar date. */
export function parseAnniversaryDate(value: string): Date {
  const datePart = value.split('T')[0];
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatAnniversaryForDb(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const ANNIVERSARY_ISO_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidAnniversaryIso(value: string): boolean {
  if (!ANNIVERSARY_ISO_PATTERN.test(value)) return false;
  const parsed = parseAnniversaryDate(value);
  if (Number.isNaN(parsed.getTime())) return false;
  return formatAnniversaryForDb(parsed) === value;
}

export function getRelationshipAnniversaryDate(relationship: Pick<Relationship, 'anniversary_date' | 'created_at'>): Date {
  if (relationship.anniversary_date) {
    return parseAnniversaryDate(relationship.anniversary_date);
  }
  return parseAnniversaryDate(relationship.created_at);
}

export function getRelationshipAnniversaryIso(relationship: Pick<Relationship, 'anniversary_date' | 'created_at'>): string {
  return formatAnniversaryForDb(getRelationshipAnniversaryDate(relationship));
}

export function hasCustomAnniversaryDate(relationship: Pick<Relationship, 'anniversary_date'>): boolean {
  return !!relationship.anniversary_date;
}

export function getAnniversaryCountdown(anniversaryDateInput: string | Date) {
  const start =
    typeof anniversaryDateInput === 'string' ? parseAnniversaryDate(anniversaryDateInput) : startOfDay(anniversaryDateInput);
  const now = startOfDay(new Date());
  const thisYear = new Date(now.getFullYear(), start.getMonth(), start.getDate());
  const next =
    thisYear >= now
      ? thisYear
      : new Date(now.getFullYear() + 1, start.getMonth(), start.getDate());
  const daysUntil = Math.max(0, Math.ceil((next.getTime() - now.getTime()) / 86_400_000));
  const togetherDays = Math.max(0, Math.floor((now.getTime() - start.getTime()) / 86_400_000));
  return { daysUntil, togetherDays, anniversaryDate: next, togetherSince: start };
}

export function formatTogetherLabel(since: Date, togetherDays: number): string {
  if (togetherDays >= 60) {
    return formatDistanceToNowStrict(since, { addSuffix: false });
  }
  return `${togetherDays} ${togetherDays === 1 ? 'day' : 'days'}`;
}

export function formatAnniversaryDisplay(date: Date): string {
  return format(date, 'MMMM d, yyyy');
}
