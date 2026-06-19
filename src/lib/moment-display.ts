import {
  endOfWeek,
  format,
  getYear,
  isSameMonth,
  isThisWeek,
  isToday,
  isWithinInterval,
  isYesterday,
  startOfWeek,
  subMonths,
  subWeeks,
} from 'date-fns';

import { getFirstName } from '@/lib/avatar-initial';

import type { Moment, UserProfile } from '@/types/database';

type MomentAuthorSource = Pick<UserProfile, 'id' | 'name' | 'email' | 'avatar_url'>;

function toAuthorProfile(source: MomentAuthorSource): UserProfile {
  return {
    id: source.id,
    email: source.email ?? '',
    name: source.name,
    avatar_url: source.avatar_url,
    created_at: '',
  };
}

export function enrichMomentWithAuthor(
  moment: Moment,
  user?: MomentAuthorSource | null,
  partner?: MomentAuthorSource | null,
): Moment {
  const reactions = moment.reactions ?? {};
  if (moment.author) return { ...moment, reactions };

  let author: UserProfile | undefined;
  if (user && moment.user_id === user.id) author = toAuthorProfile(user);
  else if (partner && moment.user_id === partner.id) author = toAuthorProfile(partner);

  return author ? { ...moment, reactions, author } : { ...moment, reactions };
}

export function enrichMomentsWithAuthors(
  moments: Moment[],
  user?: MomentAuthorSource | null,
  partner?: MomentAuthorSource | null,
): Moment[] {
  return moments.map((moment) => enrichMomentWithAuthor(moment, user, partner));
}

export function groupMomentsByUser(moments: Moment[], userId: string, partnerId?: string | null) {
  const mine = moments.filter((m) => m.user_id === userId);
  const theirs = partnerId ? moments.filter((m) => m.user_id === partnerId) : [];
  return { mine, theirs };
}

export function isMediaMoment(moment: Moment): boolean {
  return (moment.type === 'photo' || moment.type === 'video') && !!moment.media_url;
}

export function momentPreviewLabel(moment: Moment): string {
  if (moment.type === 'video') return 'Video moment';
  if (moment.type === 'photo') return 'Photo moment';
  return 'Shared moment';
}

export function getMomentSenderFirstName(
  moment: Moment,
  user?: { id: string; name?: string | null } | null,
  partner?: { name?: string | null } | null,
): string {
  if (user && moment.user_id === user.id) {
    return getFirstName(user.name) ?? 'You';
  }
  return getFirstName(moment.author?.name ?? partner?.name) ?? 'Partner';
}

export function momentHasVisual(moment: Moment): boolean {
  return isMediaMoment(moment);
}

export function filterMediaMoments(moments: Moment[]): Moment[] {
  return moments.filter(isMediaMoment);
}

export function formatMomentDateLabel(date: Date): string {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  if (isThisWeek(date, { weekStartsOn: 1 })) return format(date, 'EEEE');
  return format(date, 'MMMM d, yyyy');
}

export function groupMomentsByDate(moments: Moment[]): { key: string; label: string; moments: Moment[] }[] {
  const groups = new Map<string, Moment[]>();

  for (const moment of moments) {
    const key = format(new Date(moment.created_at), 'yyyy-MM-dd');
    const bucket = groups.get(key);
    if (bucket) bucket.push(moment);
    else groups.set(key, [moment]);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => ({
      key,
      label: formatMomentDateLabel(new Date(key)),
      moments: items,
    }));
}

const WEEK_OPTS = { weekStartsOn: 1 as const };

/** Locket-style buckets: Today → This week → Last week → months → years. */
export function groupMomentsForHistory(moments: Moment[]): { key: string; label: string; moments: Moment[] }[] {
  const today: Moment[] = [];
  const thisWeek: Moment[] = [];
  const lastWeek: Moment[] = [];
  const thisMonth: Moment[] = [];
  const lastMonth: Moment[] = [];
  const byMonth = new Map<string, Moment[]>();
  const byYear = new Map<string, Moment[]>();

  const now = new Date();
  const thisWeekInterval = {
    start: startOfWeek(now, WEEK_OPTS),
    end: endOfWeek(now, WEEK_OPTS),
  };
  const lastWeekInterval = {
    start: startOfWeek(subWeeks(now, 1), WEEK_OPTS),
    end: endOfWeek(subWeeks(now, 1), WEEK_OPTS),
  };
  const lastMonthDate = subMonths(now, 1);
  const currentYear = getYear(now);

  for (const moment of moments) {
    const d = new Date(moment.created_at);
    if (isToday(d)) {
      today.push(moment);
    } else if (isWithinInterval(d, thisWeekInterval)) {
      thisWeek.push(moment);
    } else if (isWithinInterval(d, lastWeekInterval)) {
      lastWeek.push(moment);
    } else if (isSameMonth(d, now)) {
      thisMonth.push(moment);
    } else if (isSameMonth(d, lastMonthDate)) {
      lastMonth.push(moment);
    } else if (getYear(d) === currentYear) {
      const key = format(d, 'yyyy-MM');
      const bucket = byMonth.get(key);
      if (bucket) bucket.push(moment);
      else byMonth.set(key, [moment]);
    } else if (getYear(d) === currentYear - 1) {
      const bucket = byYear.get('last-year');
      if (bucket) bucket.push(moment);
      else byYear.set('last-year', [moment]);
    } else {
      const key = String(getYear(d));
      const bucket = byYear.get(key);
      if (bucket) bucket.push(moment);
      else byYear.set(key, [moment]);
    }
  }

  const sections: { key: string; label: string; moments: Moment[] }[] = [];
  if (today.length) sections.push({ key: 'today', label: 'Today', moments: today });
  if (thisWeek.length) sections.push({ key: 'this-week', label: 'This week', moments: thisWeek });
  if (lastWeek.length) sections.push({ key: 'last-week', label: 'Last week', moments: lastWeek });
  if (thisMonth.length) sections.push({ key: 'this-month', label: 'This month', moments: thisMonth });
  if (lastMonth.length) sections.push({ key: 'last-month', label: 'Last month', moments: lastMonth });

  for (const [key, items] of Array.from(byMonth.entries()).sort(([a], [b]) => b.localeCompare(a))) {
    sections.push({
      key,
      label: format(new Date(key + '-01'), 'MMMM yyyy'),
      moments: items,
    });
  }

  if (byYear.has('last-year')) {
    sections.push({ key: 'last-year', label: 'Last year', moments: byYear.get('last-year')! });
  }
  for (const [key, items] of Array.from(byYear.entries())
    .filter(([k]) => k !== 'last-year')
    .sort(([a], [b]) => Number(b) - Number(a))) {
    sections.push({ key, label: key, moments: items });
  }

  return sections;
}

/** Calendar-month buckets for shared album previews (newest first). */
export function groupMomentsByMonth(moments: Moment[]): { key: string; label: string; moments: Moment[] }[] {
  const groups = new Map<string, Moment[]>();

  for (const moment of moments) {
    const key = format(new Date(moment.created_at), 'yyyy-MM');
    const bucket = groups.get(key);
    if (bucket) bucket.push(moment);
    else groups.set(key, [moment]);
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, items]) => ({
      key,
      label: format(new Date(key + '-01'), 'MMMM yyyy'),
      moments: items,
    }));
}

export function countMomentReactions(moment: Moment): number {
  return Object.values(moment.reactions ?? {}).reduce((sum, ids) => sum + ids.length, 0);
}

export function countMomentHearts(moment: Moment): number {
  return (moment.reactions?.['❤️'] ?? []).length;
}

/** Reaction from a specific user on this moment. */
export function getReactionBadgeFromUser(
  moment: Moment,
  actorId?: string | null,
): { emoji: string; count: number } | null {
  if (!actorId) return null;

  const entries = Object.entries(moment.reactions ?? {}).filter(([, ids]) => ids.includes(actorId));
  if (entries.length === 0) return null;

  const preferred = entries.find(([emoji]) => emoji === '❤️') ?? entries[0];
  return { emoji: preferred[0], count: entries.length };
}

/** On history grid: partner's reaction on your moments, your reaction on theirs. */
export function getHistoryReactionBadge(
  moment: Moment,
  userId: string,
  partnerId?: string | null,
): { emoji: string; count: number } | null {
  if (!partnerId || !userId) return null;
  const reactorId = moment.user_id === userId ? partnerId : userId;
  return getReactionBadgeFromUser(moment, reactorId);
}

/** @deprecated use getHistoryReactionBadge */
export function getPartnerReactionBadge(
  moment: Moment,
  partnerId?: string | null,
): { emoji: string; count: number } | null {
  return getReactionBadgeFromUser(moment, partnerId);
}

export const MOMENT_VIEWER_EMOJIS = ['❤️', '😂', '🥹', '🔥', '✨'] as const;

/** Primary Locket arc on home + preview */
export const LOCKET_ARC_EMOJIS = ['😂', '❤️', '🥹', '🔥'] as const;

/** Opened via + on the arc */
export const LOCKET_EXTRA_EMOJIS = ['✨', '😍', '👏', '😮', '🙌', '😢'] as const;

export const HOME_MOMENT_TTL_MS = 24 * 60 * 60 * 1000;

export function isMomentWithinHomeWindow(moment: Moment, now = Date.now()): boolean {
  return now - new Date(moment.created_at).getTime() <= HOME_MOMENT_TTL_MS;
}

export function filterMomentsForHome(moments: Moment[]): Moment[] {
  return moments.filter(isMomentWithinHomeWindow);
}

export function isMomentUnseenByUser(moment: Moment, userId: string): boolean {
  return !(moment.viewed_by ?? []).includes(userId);
}

export function partnerHasUnseenMoments(
  moments: Moment[],
  userId: string,
  partnerId?: string | null,
): boolean {
  if (!partnerId || !userId) return false;
  return moments.some(
    (m) =>
      m.user_id === partnerId &&
      momentHasVisual(m) &&
      isMomentWithinHomeWindow(m) &&
      isMomentUnseenByUser(m, userId),
  );
}

export function getPartnerActiveMoments(
  moments: Moment[],
  userId: string | undefined,
  partnerId: string | null | undefined,
): Moment[] {
  if (!moments.length) return [];
  const partnerMedia = filterMediaMoments(
    moments.filter((m) => (partnerId ? m.user_id === partnerId : !!userId && m.user_id !== userId)),
  );
  return filterMomentsForHome(partnerMedia);
}

export function getUserReactionEmoji(
  moment: Moment,
  userId: string,
): string | null {
  for (const [emoji, ids] of Object.entries(moment.reactions ?? {})) {
    if (ids.includes(userId)) return emoji;
  }
  return null;
}

export function listMomentReactions(moment: Moment): { emoji: string; userIds: string[] }[] {
  return Object.entries(moment.reactions ?? {})
    .filter(([, ids]) => ids.length > 0)
    .map(([emoji, userIds]) => ({ emoji, userIds }));
}

/** All reactions on a moment, labeled by who reacted. */
export function getMomentReactionHistory(
  moment: Moment,
  userId: string,
  partnerId?: string | null,
  partnerName?: string | null,
): { emoji: string; label: string; isYou: boolean }[] {
  const partnerLabel = partnerName?.split(' ')[0] ?? 'Partner';
  const items: { emoji: string; label: string; isYou: boolean }[] = [];

  for (const [emoji, ids] of Object.entries(moment.reactions ?? {})) {
    for (const id of ids) {
      if (id === userId) items.push({ emoji, label: 'You', isYou: true });
      else if (partnerId && id === partnerId)
        items.push({ emoji, label: partnerLabel, isYou: false });
    }
  }

  return items;
}

export function reactionOrbitPositions(count: number, radiusX: number, radiusY: number) {
  if (count === 0) return [];
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    return { x: Math.cos(angle) * radiusX, y: Math.sin(angle) * radiusY };
  });
}

export function toggleMomentReactionForUser(
  reactions: Record<string, string[]>,
  userId: string,
  emoji: string,
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const [key, ids] of Object.entries(reactions)) {
    const filtered = ids.filter((id) => id !== userId);
    if (filtered.length) next[key] = filtered;
  }
  const bucket = next[emoji] ?? [];
  if (!bucket.includes(userId)) next[emoji] = [...bucket, userId];
  return next;
}
